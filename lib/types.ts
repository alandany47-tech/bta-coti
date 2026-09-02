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

export type Product = {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  is_custom_price: boolean;
};

export type QuoteItem = {
  product_id: string;
  sku: string;
  name: string;
  unit_price: number;
  quantity: number;
  is_custom_price: boolean;
};

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";

export type Quote = {
  id: string;
  tenant_id: string;
  client_name: string;
  client_phone: string;
  items: QuoteItem[];
  total_amount: number;
  pdf_url: string | null;
  status: QuoteStatus;
  created_at: string;
};

export type ProductImportRow = {
  sku: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
};
