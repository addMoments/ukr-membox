export type AdvertorialLayout = 'none' | 'single' | '1x1' | '2x1' | '1x2' | '2x2';

export interface AdvertorialCell {
  index: number;
  image_url: string;
  link_url: string;
}

export interface AdvertorialConfig {
  layout: AdvertorialLayout;
  cells: AdvertorialCell[];
}

export interface AdvertorialResponse {
  enabled: boolean;
  config: AdvertorialConfig;
}

export interface AdvertorialUploadUrlRequest {
  file_name: string;
  content_type: string;
  size_bytes: number;
}

export interface AdvertorialUploadUrlResponse {
  upload_url: string;
  public_url: string;
  key: string;
  expires_in_sec: number;
  required_headers: Record<string, string>;
}
