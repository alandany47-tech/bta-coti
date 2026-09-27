import "server-only";
import { AwsClient } from "aws4fetch";

type R2Env = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

function env(): R2Env | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  return accountId && accessKeyId && secretAccessKey && bucket
    ? { accountId, accessKeyId, secretAccessKey, bucket }
    : null;
}

export const r2Configured = () => env() !== null;

function bucketClient() {
  const cfg = env();
  if (!cfg) throw new Error("R2 no está configurado");
  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  return { client, bucketUrl: `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}` };
}

function target(key: string) {
  const { client, bucketUrl } = bucketClient();
  const path = key.split("/").map(encodeURIComponent).join("/");
  return { client, url: `${bucketUrl}/${path}` };
}

export const SIGN_EXPIRES_SECONDS = 300;

/**
 * URL PUT prefirmada (5 min) con `Content-Type` y `Content-Length` firmados: el cliente solo
 * puede subir exactamente esos bytes, así la URL no sirve para sobrescribir con otro tamaño
 * después de confirmar. El HEAD al confirmar sigue midiendo el tamaño real.
 */
export async function presignPut(key: string, contentType: string, bytes: number): Promise<string> {
  const { client, url } = target(key);
  const signed = await client.sign(`${url}?X-Amz-Expires=${SIGN_EXPIRES_SECONDS}`, {
    method: "PUT",
    headers: { "Content-Type": contentType, "Content-Length": String(bytes) },
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

export async function headObject(key: string): Promise<{ bytes: number; contentType: string } | null> {
  const { client, url } = target(key);
  const response = await client.fetch(url, { method: "HEAD" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`R2 HEAD ${response.status}`);
  return {
    bytes: Number(response.headers.get("content-length") ?? 0),
    contentType: response.headers.get("content-type") ?? "",
  };
}

/** Borra en tandas de 25 (no 1000 fetch a la vez). Devuelve cuántas llaves fallaron (404 no cuenta). */
export async function deleteObjects(keys: (string | null | undefined)[]): Promise<number> {
  const valid = keys.filter((key): key is string => Boolean(key));
  let failed = 0;
  for (let i = 0; i < valid.length; i += 25) {
    await Promise.all(
      valid.slice(i, i + 25).map(async (key) => {
        const { client, url } = target(key);
        const response = await client.fetch(url, { method: "DELETE" });
        if (!response.ok && response.status !== 404) {
          failed += 1;
          console.error("R2 DELETE falló", key, response.status);
        }
      }),
    );
  }
  return failed;
}

export type ListedObject = { key: string; lastModified: Date; bytes: number };

function xmlText(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? xmlText(match[1]) : null;
}

/** Una página de ListObjectsV2 (hasta 1000 llaves). `next` es null en la última. */
export async function listObjects(
  prefix: string,
  continuationToken?: string | null,
): Promise<{ objects: ListedObject[]; next: string | null }> {
  const { client, bucketUrl } = bucketClient();
  const url = new URL(bucketUrl);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", prefix);
  url.searchParams.set("max-keys", "1000");
  if (continuationToken) url.searchParams.set("continuation-token", continuationToken);

  const response = await client.fetch(url.toString(), { method: "GET" });
  if (!response.ok) throw new Error(`R2 LIST ${response.status}`);
  const xml = await response.text();

  const objects: ListedObject[] = [];
  for (const [, block] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const key = tag(block, "Key");
    const modified = tag(block, "LastModified");
    if (!key || !modified) continue;
    objects.push({ key, lastModified: new Date(modified), bytes: Number(tag(block, "Size") ?? 0) });
  }
  const truncated = tag(xml, "IsTruncated") === "true";
  return { objects, next: truncated ? tag(xml, "NextContinuationToken") : null };
}
