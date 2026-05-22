export type FullfillmentType = 'digital' | 'physical';

export interface Product {
  uid: string;
  price: number;
  id: string;
  display_name_en?: string;
  display_name_uk?: string;
  display_description_en?: string;
  display_description_uk?: string;
  display_bullets_en?: string;
  display_bullets_uk?: string;
  created_at: string;
  options: Record<string, any> & { image?: string; mobile_image?: string };
  priority: number;
  fullfillment_type: FullfillmentType;
  granted_features: number[];
  voice_included?: boolean;
  advertorial_included?: boolean;
  sponsored_included?: boolean;
  is_add_on: boolean;
  is_enabled: boolean;
}