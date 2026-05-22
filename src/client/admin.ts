import { SERV_ROOT } from '../consts';
import { AddPanelOrderAdminPayload, AdminPanelAdmin, AdminRole } from '../types/admin';
import { fetch as authFetch } from './core';

const emptyAdminRole: AdminRole = {
  is_admin: false,
  is_super_admin: false,
  is_order_admin: false,
  was_panel_admin: false,
  has_active_event: false,
};

export const ADMIN_NO_ACCESS_PATH = '/admin/no-access';

const ADMIN_ROLE_CACHE_TTL_MS = 60 * 1000;
let cachedAdminRole: { value: AdminRole; expiresAt: number } | null = null;
let pendingAdminRoleRequest: Promise<AdminRole> | null = null;

type AdminRoleRequestOptions = {
  forceRefresh?: boolean;
};

// Ne: Backend admin rol cevabini frontend'in guvenle kullanacagi sekle cevirir.
// Nasil: Eksik veya beklenmeyen alanlari false kabul eder.
// Neden: Order admin icin finansal alanlar gibi UI kararlarini tek, net role objesiyle vermek.
export function normalizeAdminRole(value: unknown): AdminRole {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    is_admin: raw.is_admin === true,
    is_super_admin: raw.is_super_admin === true,
    is_order_admin: raw.is_order_admin === true,
    was_panel_admin: raw.was_panel_admin === true,
    has_active_event: raw.has_active_event === true,
  };
}

// Ne: Artik admin olmayan eski panel adminin eventsiz ozel durumunu yakalar.
// Nasil: Backend'in yeni was_panel_admin ve has_active_event alanlarini is_admin ile birlikte okur.
// Neden: Bu kullanici normal services/prices akisana dusmemeli, admin yetki yok ekranina gitmeli.
export function isFormerPanelAdminWithoutActiveEvent(role: AdminRole): boolean {
  return role.is_admin === false && role.was_panel_admin === true && role.has_active_event === false;
}

// Ne: Admin panel URL'lerini login redirect kararinda ayirt eder.
// Nasil: Sadece /admin ve /admin/... path'lerini admin hedefi sayar.
// Neden: Backend eski goto:/admin/orders dondurse bile is_admin=false kullanici admin paneline tasinmasin.
function isAdminRedirectPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/');
}

// Ne: Admin olmayan kullanicinin admin hedefi yerine gidecegi normal hedefi secer.
// Nasil: Aktif eventi varsa /events'e, yoksa normal kullanici satin alma akisi olan services/prices'a dondurur.
// Neden: has_active_event admin yetkisi degildir; sadece normal event sahibi akisini belirler.
function resolveNonAdminFallbackPath(role: AdminRole): string {
  return role.has_active_event ? '/events' : '/events/services-and-prices';
}

// Ne: Login sonrasi gidilecek hedefi admin rol bilgisine gore secer.
// Nasil: Taze admin check yapar; admin olmayan kullaniciya admin path geldiyse normal event/satin alma hedefine cevirir.
// Neden: Silinmis order admin backend goto'su eski kalsa bile admin paneline atilmasin.
export async function resolvePostSignInRedirect(res: Response, next: string | null = null): Promise<string> {
  const role = await getAdminRoleOrEmpty({ forceRefresh: true });
  if (isFormerPanelAdminWithoutActiveEvent(role)) {
    return ADMIN_NO_ACCESS_PATH;
  }

  if (next && (!isAdminRedirectPath(next) || role.is_admin)) {
    return next;
  }

  const text = await res.text().catch(() => '');
  if (text.startsWith('goto:')) {
    const target = text.slice(5);
    if (isAdminRedirectPath(target) && !role.is_admin) {
      return resolveNonAdminFallbackPath(role);
    }
    return target;
  }

  return '/events';
}

// Ne: Site admin rolunu backend'den kontrol eder.
// Nasil: GET /api/admin/check sonucunu kisa sure memory cache'te tutar ve eszamanli istekleri tek promise'te birlestirir.
// Neden: Admin route guard ve sayfa icindeki UI kararlarinda ayni rol bilgisi tekrar tekrar istenip paneli yavaslatmasin.
export async function getAdminRole(options: AdminRoleRequestOptions = {}): Promise<AdminRole> {
  const now = Date.now();
  if (!options.forceRefresh && cachedAdminRole && cachedAdminRole.expiresAt > now) {
    return cachedAdminRole.value;
  }

  if (!options.forceRefresh && pendingAdminRoleRequest) {
    return pendingAdminRoleRequest;
  }

  pendingAdminRoleRequest = (async () => {
    const res = await authFetch(`${SERV_ROOT}/api/admin/check`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    const role = normalizeAdminRole(data);

    cachedAdminRole = {
      value: role,
      expiresAt: Date.now() + ADMIN_ROLE_CACHE_TTL_MS,
    };

    return role;
  })();

  try {
    return await pendingAdminRoleRequest;
  } finally {
    pendingAdminRoleRequest = null;
  }
}

// Ne: Admin rol kontrolu hata verirse guvenli default role doner.
// Nasil: getAdminRole hatasini yutar ve tum yetkileri false yapar.
// Neden: Public akislarda admin check basarisiz diye kullaniciyi admin ekranina tasimamak.
export async function getAdminRoleOrEmpty(options: AdminRoleRequestOptions = {}): Promise<AdminRole> {
  try {
    return await getAdminRole(options);
  } catch {
    return emptyAdminRole;
  }
}

// Ne: Super admin'in yonettigi order admin listesini getirir.
// Nasil: GET /api/admin/panel-admins endpointini cagirir ve array degilse bos liste dondurur.
// Neden: Panel Admins ekraninda backend kontratina bagli, sade bir liste kaynagi olsun.
export async function getPanelAdmins(): Promise<AdminPanelAdmin[]> {
  const res = await authFetch(`${SERV_ROOT}/api/admin/panel-admins`, {
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();

  return Array.isArray(data) ? (data as AdminPanelAdmin[]) : [];
}

// Ne: Super admin tarafindan yeni order admin hesabi olusturur.
// Nasil: Email, isim ve gecici sifre bilgilerini role=order_admin ile POST eder.
// Neden: Yeni backend kontratinda mevcut kullaniciya rol vermek yerine order admin hesabi bu ekrandan yaratiliyor.
export async function addPanelOrderAdmin(payload: AddPanelOrderAdminPayload): Promise<void> {
  await authFetch(`${SERV_ROOT}/api/admin/panel-admins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
}

// Ne: Bir kullanicinin order admin kaydini siler.
// Nasil: userUID path parametresiyle DELETE /api/admin/panel-admins/:userUID cagirir.
// Neden: Super admin env super adminlerine dokunmadan DB'deki order admin yetkisini kaldirabilsin.
export async function deletePanelAdmin(userUID: string): Promise<void> {
  await authFetch(`${SERV_ROOT}/api/admin/panel-admins/${userUID}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
}

