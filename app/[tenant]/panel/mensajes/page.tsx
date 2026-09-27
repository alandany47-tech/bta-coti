import { redirect } from "next/navigation";
import { MessageTemplateEditor } from "@/components/messages/message-template-editor";
import { getPanelContext, hasRole } from "@/lib/auth/panel";
import { DEFAULT_TEMPLATES, isMessageModule, type MessageModule } from "@/lib/message-templates";

export default async function MessagesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { supabase, tenant, role } = await getPanelContext(slug);
  if (!hasRole(role, "editor")) redirect("/panel");

  const [modulesResult, templatesResult] = await Promise.all([
    supabase.rpc("tenant_modules", { p_tenant: tenant.id }),
    supabase.from("message_templates").select("module, body").eq("tenant_id", tenant.id),
  ]);
  const modules = modulesResult.data as string[] | null;
  const templates = templatesResult.data as { module: string; body: string }[] | null;
  const bodyByModule = new Map((templates ?? []).map((t) => [t.module, t.body]));

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl">Mensajes de WhatsApp</h1>
        <p className="text-sm text-ink-2">
          El mensaje que acompaña cada cotización. Usa las variables para que se llenen solas con
          los datos de cada cliente.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {(modules ?? []).filter((m): m is MessageModule => isMessageModule(m)).map((module) => (
          <MessageTemplateEditor
            key={module}
            tenantSlug={slug}
            module={module}
            initialBody={bodyByModule.get(module) ?? DEFAULT_TEMPLATES[module]}
          />
        ))}
      </div>
    </div>
  );
}
