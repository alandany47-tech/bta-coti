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

function target(key: string) {
  const cfg = env();
  if (!cfg) throw new Error("R2 no está configurado");
  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const path = key.split("/").map(encodeURIComponent).join("/");
  return { client, url: `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${path}` };
}

export const SIGN_EXPIRES_SECONDS = 300;

/**
 * URL PUT prefirmada (5 min). aws4fetch no firma content-type ni content-length, así que el
 * tamaño no queda atado a la firma: el tamaño real se verifica con `headObject` al confirmar.
 */
export async function presignPut(key: string): Promise<string> {
  const { client, url } = target(key);
  const signed = await client.sign(`${url}?X-Amz-Expires=${SIGN_EXPIRES_SECONDS}`, {
    method: "PUT",
    aws: { signQuery: true },
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

export async function deleteObjects(keys: (string | null | undefined)[]): Promise<void> {
  await Promise.all(
    keys.filter((key): key is string => Boolean(key)).map(async (key) => {
      const { client, url } = target(key);
      const response = await client.fetch(url, { method: "DELETE" });
      if (!response.ok && response.status !== 404) console.error("R2 DELETE falló", key, response.status);
    }),
  );
}
