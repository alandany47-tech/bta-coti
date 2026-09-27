export type TenantStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  status: TenantStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
};

/**
 * Vista pública de un tenant: lo que la anon key puede leer. notes/stripe_*
 * están recortados por GRANT de columna (ver migración 0003) porque son
 * datos internos del admin — nunca deben llegar al storefront público.
 */
export type PublicTenant = Omit<
  Tenant,
  "stripe_customer_id" | "stripe_subscription_id" | "notes"
>;

/** Fila de tenants + plan y conteos de `usage` que arma el Panel de Administración Master. */
export type AdminTenantRow = Tenant & {
  plan_name: string;
  source: "self_signup" | "admin" | "demo_clone" | null;
  status_reason: string | null;
  items_count: number;
  quotes_month: number;
};

export type PropertyStatus = "available" | "reserved" | "sold";

export type Property = {
  id: string;
  tenant_id: string;
  title: string;
  unit_number: string;
  m2_interior: number;
  m2_exterior: number;
  m2_total: number;
  parking_spaces: number;
  list_price: number;
  images: string[];
  floor_plan_url: string | null;
  status: PropertyStatus;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  tenant_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  created_at: string;
};

export type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";

export type Quote = {
  id: string;
  tenant_id: string;
  property_id: string | null;
  client_id: string | null;
  client_name: string;
  client_phone: string;
  discount_pct: number;
  down_payment_pct: number;
  down_payment_amount: number;
  installments_count: number;
  monthly_payment_amount: number;
  final_payment_amount: number;
  total_amount: number;
  notes: string | null;
  status: QuoteStatus;
  created_at: string;
};

/** Fila esperada del Excel de importación masiva de cartera. */
export type PropertyImportRow = {
  unit_number: string;
  title: string;
  m2_interior: number;
  m2_exterior: number;
  m2_total: number;
  parking_spaces: number;
  list_price: number;
};
