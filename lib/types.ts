export type TenantStatus = "active" | "inactive";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  status: TenantStatus;
  created_at: string;
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

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";

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
  pdf_url: string | null;
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
