export interface AdminProductOptions {
  guest_count?: number;
  media_count?: number;
  activation_days?: number;
  storage_days?: number;
  voice_included?: boolean;
  advertorial_included?: boolean;
  sponsored_included?: boolean;
  image?: string;
  mobile_image?: string;
}

export interface AdminProduct {
  uid: string;
  id: string;
  price: number;
  display_name_en?: string;
  display_name_uk?: string;
  display_description_en?: string;
  display_description_uk?: string;
  display_bullets_en?: string;
  display_bullets_uk?: string;
  options: AdminProductOptions;
  priority: number;
  fullfillment_type: string;
  granted_features: number[];
  voice_included?: boolean;
  advertorial_included?: boolean;
  sponsored_included?: boolean;
  is_add_on: boolean;
  is_enabled: boolean;
}

export interface UpdateAdminProductPayload {
  display_name_en?: string;
  display_name_uk?: string;
  display_description_en?: string;
  display_description_uk?: string;
  display_bullets_en?: string;
  display_bullets_uk?: string;
  price?: number;
  guest_count?: number;
  media_count?: number;
  activation_period_days?: number;
  storage_period_days?: number;
  voice_included?: boolean;
  sponsored_included?: boolean;
  is_enabled?: boolean;
  options?: {
    image?: string;
    mobile_image?: string;
  };
}

export interface AddonUploadUrlRequest {
  product_uid: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
}

export interface AddonUploadUrlResponse {
  upload_url: string;
  public_url: string;
  key: string;
  expires_in_sec: number;
  required_headers: Record<string, string>;
}
