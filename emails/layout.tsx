import type { ReactNode } from "react";
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import { BRAND } from "@/lib/brand";
import { mail } from "@/emails/tokens";

/** Estructura común de los correos: marca arriba, contenido en una hoja, pie con soporte. */
export function EmailLayout({
  preview,
  title,
  children,
}: {
  preview: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Html lang="es-MX">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: "32px 12px", backgroundColor: mail.paper, fontFamily: mail.sans, color: mail.ink }}>
        <Container style={{ maxWidth: 520, margin: "0 auto" }}>
          <Text style={{ margin: "0 0 20px", fontFamily: mail.serif, fontSize: 20, letterSpacing: "0.04em", color: mail.ink }}>
            {BRAND.name}
          </Text>
          <Section style={{ backgroundColor: mail.surface, border: `1px solid ${mail.line}`, borderRadius: 8, padding: "32px 28px" }}>
            <Heading as="h1" style={{ margin: "0 0 16px", fontFamily: mail.serif, fontWeight: 400, fontSize: 26, lineHeight: "1.25", color: mail.ink }}>
              {title}
            </Heading>
            {children}
          </Section>
          <Text style={{ margin: "20px 4px 0", fontSize: 12, lineHeight: "1.6", color: mail.ink3 }}>
            ¿Dudas? Responde este correo o escríbenos a{" "}
            <Link href={`mailto:soporte@${BRAND.domain}`} style={{ color: mail.ink2 }}>
              soporte@{BRAND.domain}
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const P = ({ children }: { children: ReactNode }) => (
  <Text style={{ margin: "0 0 16px", fontSize: 16, lineHeight: "1.6", color: mail.ink2 }}>{children}</Text>
);

export const Cta = ({ href, children }: { href: string; children: ReactNode }) => (
  <Button
    href={href}
    style={{ display: "inline-block", backgroundColor: mail.ink, color: mail.paper, fontSize: 15, fontWeight: 600, textDecoration: "none", padding: "12px 22px", borderRadius: 6 }}
  >
    {children}
  </Button>
);

export const Divider = () => <Hr style={{ border: "none", borderTop: `1px solid ${mail.line}`, margin: "24px 0" }} />;

export const Small = ({ children }: { children: ReactNode }) => (
  <Text style={{ margin: "0 0 8px", fontSize: 14, lineHeight: "1.6", color: mail.ink3 }}>{children}</Text>
);

export const Steps = ({ items }: { items: string[] }) => (
  <Section style={{ margin: "0 0 20px", backgroundColor: mail.paper, borderRadius: 6, padding: "14px 18px" }}>
    {items.map((item, index) => (
      <Text key={item} style={{ margin: index === items.length - 1 ? 0 : "0 0 8px", fontSize: 15, lineHeight: "1.5", color: mail.ink }}>
        <span style={{ color: mail.accent, fontWeight: 600 }}>{index + 1}.</span> {item}
      </Text>
    ))}
  </Section>
);

export const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} style={{ color: mail.accent, textDecoration: "underline" }}>
    {children}
  </Link>
);
