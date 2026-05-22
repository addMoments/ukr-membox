export interface PartnershipMetrics {
  promo_count: number;
  usage_count: number;
  gross_total: number;
  discount_total: number;
  net_total: number;
  first_used_at?: string | null;
  last_used_at?: string | null;
}

export interface AdminPartnership {
  uid: string;
  name: string;
  surname: string;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  metrics?: PartnershipMetrics;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePartnershipPayload {
  name: string;
  surname: string;
  company_name?: string;
  phone?: string;
  email?: string;
}

export interface UpdatePartnershipPayload {
  name?: string;
  surname?: string;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active?: boolean;
}
