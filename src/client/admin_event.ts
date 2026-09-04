import { SERV_ROOT } from '../consts';
import { fetch as authFetch } from './core';

export interface AdminEvent {
  uid: string;
  name: string;
  status: string;
  activation_date: string;
  active_until: string;
  storage_until: string;
  deleted_at: string;
  created_at: string;
  admin_emails: string;
}

// Ne: Backend hata gövdesini okunabilir bir Error'a cevirir.
// Nasil: Cevap gövdesi bosca degilse onu kullanir, degilse HTTP kodunu yazar.
// Neden: Bu ekranda hatalarin sebebi onemli -- aktive olmus event'in tarihi
//        degistirilemez (409) gibi durumlar kullaniciya aynen gosterilmeli.
async function throwIfNotOk(res: Response, what: string) {
  if (res.ok) return;
  const body = (await res.text()).trim();
  throw new Error(body || `${what} failed (HTTP ${res.status})`);
}

export async function getAdminEvents(search: string): Promise<AdminEvent[]> {
  const query = search ? `?q=${encodeURIComponent(search)}` : '';
  const res = await authFetch(`${SERV_ROOT}/api/admin/events${query}`, {
    headers: { Accept: 'application/json' },
  });
  await throwIfNotOk(res, 'GET /api/admin/events');
  const data = await res.json();
  return Array.isArray(data) ? (data as AdminEvent[]) : [];
}

// Yalnizca activation_date gonderilir; active_until'i DB kendisi hesaplayip geri doner.
export async function updateAdminEventActivationDate(
  eventUID: string,
  activationDate: string,
): Promise<{ activation_date: string; active_until: string }> {
  const res = await authFetch(`${SERV_ROOT}/api/admin/events/${eventUID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ activation_date: activationDate }),
  });
  await throwIfNotOk(res, 'PATCH /api/admin/events');
  return res.json();
}

export async function deleteAdminEvent(eventUID: string): Promise<{ already_closed: boolean }> {
  const res = await authFetch(`${SERV_ROOT}/api/admin/events/${eventUID}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  await throwIfNotOk(res, 'DELETE /api/admin/events');
  return res.json();
}
