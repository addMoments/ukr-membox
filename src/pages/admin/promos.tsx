import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  createAdminPromo,
  deleteAdminPromo,
  getAdminPromos,
  setAdminPromoActive,
  updateAdminPromo,
} from '../../client/promo';
import { AdminPromo, CreatePromoPayload, UpdatePromoPayload } from '../../types/promo';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import V2Header from '../../v2-components/V2Header';
import '../../v2-styles/AdminPageHeader.css';
import '../../v2-styles/AdminOrders.css';

// Ne: ISO tarih degerini admin ekraninda okunur hale getirir.
// Nasil: Bos degerde tire, dolu degerde en-GB tarih/saat formatini kullanir.
// Neden: Promo gecerlilik araliklari listede hizli kontrol edilebilsin.
function formatDate(str?: string | null) {
  if (!str) return '-';
  return new Date(str).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Ne: ISO tarihini datetime-local input'unun bekledigi formata cevirir.
// Nasil: Date objesini ISO string'e alip ilk dakika hassasiyetindeki bolumu kullanir.
// Neden: Edit formu mevcut valid_from/valid_until degerleriyle acilsin.
function toDateTimeLocal(str?: string | null) {
  if (!str) return '';
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

// Ne: Optional create tarih alanini ISO string'e cevirir.
// Nasil: Bos inputta undefined, dolu inputta Date.toISOString dondurur.
// Neden: Create payload'u bos tarihleri backend default'una biraksin.
function readOptionalIso(value: FormDataEntryValue | null): string | undefined {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return undefined;
  return new Date(raw).toISOString();
}

// Ne: Optional update tarih alanini ISO veya null olarak okur.
// Nasil: Bos inputta null, dolu inputta Date.toISOString dondurur.
// Neden: Edit formunda tarih alani temizlenirse backend'e temizleme niyeti iletilebilsin.
function readOptionalIsoOrNull(value: FormDataEntryValue | null): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  return new Date(raw).toISOString();
}

// Ne: Optional create limit alanini number olarak okur.
// Nasil: Bos inputta undefined, dolu numeric inputta number dondurur.
// Neden: Bos usage limit backend'e hic gonderilmeden sinirsiz/nullable kalabilsin.
function readOptionalNumber(value: FormDataEntryValue | null): number | undefined {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Ne: Optional update limit alanini number veya null olarak okur.
// Nasil: Bos inputta null, dolu numeric inputta number dondurur.
// Neden: Super admin mevcut usage limit degerini sonradan kaldirabilsin.
function readOptionalNumberOrNull(value: FormDataEntryValue | null): number | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

const promoExportHeaders = ['Code', 'Discount %', 'Active', 'Used', 'Usage Limit', 'Valid From', 'Valid Until', 'Created At', 'Updated At'];

// Ne: Promo listesini Excel sheet satirlarina cevirir.
// Nasil: Ilk satira kolon basliklarini, devamina promo alanlarini array-of-arrays olarak koyar.
// Neden: XLSX workbook olustururken tablo sirasi ve kolon isimleri tek yerde kontrol edilsin.
function buildPromoExportRows(items: AdminPromo[]) {
  const rows = items.map((promo) => [
    promo.code,
    promo.discount_value,
    promo.is_active ? 'Active' : 'Inactive',
    promo.usage_count ?? 0,
    promo.usage_limit_total ?? '',
    formatDate(promo.valid_from),
    formatDate(promo.valid_until),
    formatDate(promo.created_at),
    formatDate(promo.updated_at),
  ]);
  return [promoExportHeaders, ...rows];
}

// Ne: Promo satirlarindan gercek .xlsx dosyasi indirir.
// Nasil: SheetJS ile worksheet/workbook olusturur ve tarayicida writeFile download'unu tetikler.
// Neden: Super admin Excel'de direkt acilabilen promo code raporu alabilsin.
function downloadPromosXlsx(items: AdminPromo[], filename: string) {
  const worksheet = XLSX.utils.aoa_to_sheet(buildPromoExportRows(items));
  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 12 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Promo Codes');
  XLSX.writeFile(workbook, filename, { bookType: 'xlsx' });
}

// Ne: Super admin promo CRUD ekranini render eder.
// Nasil: Create formu ve her promo icin edit/enable/disable/delete aksiyonlarini backend client fonksiyonlarina baglar.
// Neden: Promo yonetimi normal adminlerden ayrilip yalnizca super admin route guard arkasinda kalsin.
function AdminPromos() {
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyByUid, setBusyByUid] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    setLoading(true);
    getAdminPromos()
      .then((data) => setPromos(data))
      .catch((err) => setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed to load promos.' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Ne: Create form verisini promo create payload'una cevirir.
  // Nasil: Uncontrolled formdan FormData okur; bos optional alanlari payload'a eklemez.
  // Neden: valid_from/valid_until/usage_limit_total bos birakildiginda backend default ve nullable davranisini korusun.
  const buildCreatePayload = (form: HTMLFormElement): { payload?: CreatePromoPayload; error?: string } => {
    const formData = new FormData(form);
    const code = String(formData.get('code') || '').trim().toUpperCase();
    const discountValue = Number(formData.get('discount_value'));
    const validFrom = readOptionalIso(formData.get('valid_from'));
    const validUntil = readOptionalIso(formData.get('valid_until'));
    const usageLimitTotal = readOptionalNumber(formData.get('usage_limit_total'));

    if (!code) return { error: 'Code is required.' };
    if (!Number.isFinite(discountValue) || discountValue <= 0) return { error: 'Discount value must be greater than 0.' };
    if (usageLimitTotal !== undefined && usageLimitTotal <= 0) return { error: 'Usage limit must be greater than 0.' };

    return {
      payload: {
        code,
        discount_value: discountValue,
        ...(validFrom ? { valid_from: validFrom } : {}),
        ...(validUntil ? { valid_until: validUntil } : {}),
        ...(usageLimitTotal !== undefined ? { usage_limit_total: usageLimitTotal } : {}),
        is_active: formData.get('is_active') === 'on',
      },
    };
  };

  // Ne: Edit form verisini promo update payload'una cevirir.
  // Nasil: Optional alanlar bos ise null gonderir, boylece backend alanlari temizleyebilir.
  // Neden: Super admin valid_until veya usage limit degerini sonradan kaldirabilsin.
  const buildUpdatePayload = (form: HTMLFormElement): { payload?: UpdatePromoPayload; error?: string } => {
    const formData = new FormData(form);
    const code = String(formData.get('code') || '').trim().toUpperCase();
    const discountValue = Number(formData.get('discount_value'));
    const usageLimitTotal = readOptionalNumberOrNull(formData.get('usage_limit_total'));

    if (!code) return { error: 'Code is required.' };
    if (!Number.isFinite(discountValue) || discountValue <= 0) return { error: 'Discount value must be greater than 0.' };
    if (usageLimitTotal !== null && usageLimitTotal <= 0) return { error: 'Usage limit must be greater than 0.' };

    return {
      payload: {
        code,
        discount_value: discountValue,
        valid_from: readOptionalIsoOrNull(formData.get('valid_from')),
        valid_until: readOptionalIsoOrNull(formData.get('valid_until')),
        usage_limit_total: usageLimitTotal,
      },
    };
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { payload, error } = buildCreatePayload(form);

    if (!payload) {
      setMessage({ ok: false, text: error || 'Please check the form.' });
      return;
    }

    setSaving(true);
    setMessage({ ok: true, text: 'Creating promo...' });
    try {
      const promo = await createAdminPromo(payload);
      setPromos((prev) => [promo, ...prev]);
      form.reset();
      setMessage({ ok: true, text: 'Promo created.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed to create promo.' });
    } finally {
      setSaving(false);
    }
  };

  const onUpdate = async (event: FormEvent<HTMLFormElement>, promo: AdminPromo) => {
    event.preventDefault();
    const { payload, error } = buildUpdatePayload(event.currentTarget);

    if (!payload) {
      setMessage({ ok: false, text: error || 'Please check the form.' });
      return;
    }

    setBusyByUid((prev) => ({ ...prev, [promo.uid]: true }));
    setMessage({ ok: true, text: 'Saving promo...' });
    try {
      const updated = await updateAdminPromo(promo.uid, payload);
      setPromos((prev) => prev.map((item) => (item.uid === promo.uid ? updated : item)));
      setMessage({ ok: true, text: 'Promo saved.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed to save promo.' });
    } finally {
      setBusyByUid((prev) => ({ ...prev, [promo.uid]: false }));
    }
  };

  const onToggle = async (promo: AdminPromo) => {
    setBusyByUid((prev) => ({ ...prev, [promo.uid]: true }));
    try {
      const updated = await setAdminPromoActive(promo.uid, !promo.is_active);
      setPromos((prev) => prev.map((item) => (item.uid === promo.uid ? updated : item)));
      setMessage({ ok: true, text: updated.is_active ? 'Promo enabled.' : 'Promo disabled.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed to update promo status.' });
    } finally {
      setBusyByUid((prev) => ({ ...prev, [promo.uid]: false }));
    }
  };

  const onDelete = async (promo: AdminPromo) => {
    if (!window.confirm(`Delete promo ${promo.code}?`)) return;
    setBusyByUid((prev) => ({ ...prev, [promo.uid]: true }));
    try {
      await deleteAdminPromo(promo.uid);
      setPromos((prev) => prev.filter((item) => item.uid !== promo.uid));
      setMessage({ ok: true, text: 'Promo deleted.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed to delete promo.' });
    } finally {
      setBusyByUid((prev) => ({ ...prev, [promo.uid]: false }));
    }
  };

  // Ne: Ekrandaki promo kodlarini Excel'de acilabilecek dosya olarak export eder.
  // Nasil: State'teki promo listesinden CSV uretip tarayici download aksiyonunu tetikler.
  // Neden: Super admin code bilgilerini panelden ayrilmadan disari alabilsin.
  const onExportPromos = () => {
    if (promos.length === 0) {
      setMessage({ ok: false, text: 'No promos to export.' });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    downloadPromosXlsx(promos, `promo-codes-${today}.xlsx`);
    setMessage({ ok: true, text: 'Promo codes exported.' });
  };

  return (
    <div className="admin-layout">
      <V2Header />
      <div className="admin-container">
        <AdminPageHeader
          breadcrumbs={[{ label: 'Admin' }, { label: 'Promos' }]}
          title="Promos"
          actions={
            <>
              <button type="button" className="admin-page-header-link" onClick={onExportPromos} disabled={loading || promos.length === 0}>
                <i className="fa-solid fa-file-export" />
                Import
              </button>
              <Link to="/admin/promos/report" className="admin-page-header-link">
                <i className="fa-solid fa-chart-line" />
                Promo Report
              </Link>
              <Link to="/admin/orders" className="admin-page-header-link">
                <i className="fa-solid fa-receipt" />
                View Orders
              </Link>
            </>
          }
        />

        <section className="admin-panel-card">
          <h2 className="admin-panel-title">Create Promo</h2>
          <form className="admin-panel-form admin-promo-form" onSubmit={onCreate}>
            <div className="admin-control-group">
              <label className="admin-control-label">Code</label>
              <input name="code" className="admin-control-input" placeholder="SUMMER10" disabled={saving} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">Discount %</label>
              <input name="discount_value" type="number" min="1" step="0.01" className="admin-control-input" placeholder="Discount % (10 = 10%)" disabled={saving} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">Valid From</label>
              <input name="valid_from" type="datetime-local" className="admin-control-input" disabled={saving} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">Valid Until</label>
              <input name="valid_until" type="datetime-local" className="admin-control-input" disabled={saving} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">Usage Limit</label>
              <input name="usage_limit_total" type="number" min="1" className="admin-control-input" placeholder="Usage limit" disabled={saving} />
            </div>
            <label className="admin-promo-check">
              <input name="is_active" type="checkbox" defaultChecked disabled={saving} />
              Active
            </label>
            <button type="submit" className="admin-save-btn" disabled={saving}>
              {saving ? 'Creating...' : 'Create'}
            </button>
          </form>
          {message && <p className={message.ok ? 'admin-panel-message-ok' : 'admin-panel-message-error'}>{message.text}</p>}
        </section>

        {loading && <div className="admin-empty">Loading promos...</div>}
        {!loading && promos.length === 0 && <div className="admin-empty">No promos yet.</div>}

        {!loading && promos.length > 0 && (
          <div className="admin-panel-list">
            {promos.map((promo) => {
              const busy = !!busyByUid[promo.uid];
              return (
                <article key={promo.uid} className="admin-panel-row admin-promo-row">
                  <form className="admin-promo-edit-form" onSubmit={(event) => onUpdate(event, promo)}>
                    <div className="admin-control-group">
                      <label className="admin-control-label">Code</label>
                      <input name="code" className="admin-control-input" defaultValue={promo.code} disabled={busy} />
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">Discount %</label>
                      <input name="discount_value" type="number" min="1" step="0.01" className="admin-control-input" defaultValue={promo.discount_value} disabled={busy} />
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">Valid From</label>
                      <input name="valid_from" type="datetime-local" className="admin-control-input" defaultValue={toDateTimeLocal(promo.valid_from)} disabled={busy} />
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">Valid Until</label>
                      <input name="valid_until" type="datetime-local" className="admin-control-input" defaultValue={toDateTimeLocal(promo.valid_until)} disabled={busy} />
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">Usage Limit</label>
                      <input name="usage_limit_total" type="number" min="1" className="admin-control-input" defaultValue={promo.usage_limit_total ?? ''} disabled={busy} />
                    </div>
                    <div className="admin-promo-meta">
                      <span className={`admin-status-badge ${promo.is_active ? 'fulfilled' : 'cancelled'}`}>
                        {promo.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span>Used: {promo.usage_count ?? 0}</span>
                      <span>From: {formatDate(promo.valid_from)}</span>
                      <span>Until: {formatDate(promo.valid_until)}</span>
                    </div>
                    <div className="admin-promo-actions">
                      <button type="submit" className="admin-save-btn" disabled={busy}>
                        {busy ? 'Saving...' : 'Save'}
                      </button>
                      <button type="button" className="admin-promo-toggle-btn" onClick={() => onToggle(promo)} disabled={busy}>
                        {promo.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button type="button" className="admin-panel-delete-btn" onClick={() => onDelete(promo)} disabled={busy}>
                        Delete
                      </button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPromos;
