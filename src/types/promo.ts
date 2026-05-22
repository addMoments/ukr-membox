export interface PromoValidationRequest {
  promo_code: string;
  purchase_info: Record<string, number>;
}

export interface PromoValidationResponse {
  promo_code_uid: string;
  promo_code_text_snapshot: string;
  gross_total: number;
  discount_amount: number;
  net_total: number;
}

export interface AdminPromo {
  uid: string;
  code: string;
  discount_type?: string;
  discount_value: number;
  valid_from?: string | null;
  valid_until?: string | null;
  usage_limit_total?: number | null;
  usage_count?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePromoPayload {
  code: string;
  discount_value: number;
  valid_from?: string;
  valid_until?: string;
  usage_limit_total?: number;
  is_active: boolean;
}

export interface UpdatePromoPayload {
  code?: string;
  discount_value?: number;
  valid_from?: string | null;
  valid_until?: string | null;
  usage_limit_total?: number | null;
  is_active?: boolean;
}

export interface PromoReportRow {
  promo_code_uid: string;
  promo_code: string;
  usage_count: number;
  gross_total: number;
  discount_total: number;
  net_total: number;
  first_used_at?: string | null;
  last_used_at?: string | null;
}
