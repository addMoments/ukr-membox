export type UploadType = 'photo' | 'video' | 'text' | 'voice';

export interface UploadEntry {
  uid: string;
  upload_type: UploadType;
  value: string;
  event_uid: string;
  client_uid: string;
  created_at: string;
  trashed_at: string;
}