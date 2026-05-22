import { S3_ROOT, SITE_ROOT } from "../consts";
import { packUUID } from "../packages/uuid";

export type EventType = 'wedding' | 'birthday' | 'corporate' | 'memorial' | 'other';
export type EventStatus = 'unpaid' | 'paid' | 'suspended';

export interface Event extends EventPublic {
  admins: string[];
  created_at: string;
  purchase_uid: string;
  status: EventStatus;
  deleted_at?: string | null;
  storage_extended_at?: string | null;
  should_show_extend_prompt?: boolean;
}

export interface EventPublic {
  uid: string;
  name: string;
  event_type: EventType;
  activation_date: string;
  active_until: string;
  storage_until?: string | null;
  description: string;
  welcome_message: string;
  image: string;
  settings?: any;
}

export const eventGuestUrl = (event: EventPublic) => {
  return SITE_ROOT + "/l/" + "q"+packUUID(event.uid);
}

export const eventQrImageUrl = (event: EventPublic) => {
  return S3_ROOT + "/events/" + packUUID(event.uid) + "/qr.png";
}