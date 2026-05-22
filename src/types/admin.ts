export interface AdminRole {
  is_admin: boolean;
  is_super_admin: boolean;
  is_order_admin: boolean;
  was_panel_admin: boolean;
  has_active_event: boolean;
}

export interface AdminPanelAdmin {
  user_uid: string;
  email: string;
  name: string;
  role: 'order_admin';
  created_at: string;
  created_by_uid: string;
  created_by_email: string;
}

export interface AddPanelOrderAdminPayload {
  email: string;
  name: string;
  password: string;
  confirm_password: string;
  role: 'order_admin';
}

