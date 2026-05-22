import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { FetchHttpError } from '../../client/core';
import {
  createAdminPromo,
  getAdminPromos,
  setAdminPromoActive,
  updateAdminPromo,
} from '../../client/promo';
import { getAdminPartnerships } from '../../client/partnership';
import { AdminPromo, CreatePromoPayload, UpdatePromoPayload } from '../../types/promo';
import { AdminPartnership } from '../../types/partnership';
import { adminText } from '../../utils/admin_i18n';
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

// Ne: Partnership dropdown'unda gosterilecek okunur etiketi uretir.
// Nasil: Isim soyismi birlestirir, firma varsa sona ekler, bos kalirsa uid'ye duser.
// Neden: Promo formunda partner secimi admin icin hizli ve ayirt edilebilir olsun.
function partnershipLabel(partnership: AdminPartnership) {
  const fullName = `${partnership.name} ${partnership.surname}`.trim();
  const company = partnership.company_name ? ` - ${partnership.company_name}` : '';
  return `${fullName || partnership.uid}${company}`;
}

// Ne: Promo response'undaki partner bilgisi icin dropdown fallback etiketi uretir.
// Nasil: Partnership objesi varsa label helper'ini kullanir, yoksa partnership_uid'yi gosterir.
// Neden: Partnership listesi gec yuklense veya mevcut partner listede olmasa bile edit select bos kalmasin.
function promoPartnershipLabel(promo: AdminPromo) {
  return promo.partnership ? partnershipLabel(promo.partnership) : (promo.partnership_uid || 'Selected partnership');
}

// Ne: Promo'nun partnership uid'sini response formatina bakmadan cikarir.
// Nasil: Once partnership_uid alanini, yoksa partnership objesindeki uid'yi kullanir.
// Neden: Backend sadece partnership objesi dondurdugunde edit dropdown ve filtre bos secime dusmesin.
function promoPartnershipUID(promo: AdminPromo) {
  return promo.partnership_uid || promo.partnership?.uid || '';
}

const at = adminText;

const promoExportHeaders = ['Code', 'Discount %', 'Active', 'Used', 'Usage Limit', 'Valid From', 'Valid Until', 'Created At', 'Updated At'];

interface PromoFilters {
  code: string;
  partnershipUID: string;
}

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
  const [partnerships, setPartnerships] = useState<AdminPartnership[]>([]);
  const [partnershipsLoading, setPartnershipsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyByUid, setBusyByUid] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [filters, setFilters] = useState<PromoFilters>({ code: '', partnershipUID: '' });

  const load = () => {
    setLoading(true);
    getAdminPromos()
      .then((data) => setPromos(data))
      .catch((err) => setMessage({ ok: false, text: err instanceof Error ? err.message : at('admin.promos.errors.load', 'Failed to load promos.', 'Не вдалося завантажити промокоди.') }))
      .finally(() => setLoading(false));
  };

  const loadPartnerships = () => {
    setPartnershipsLoading(true);
    getAdminPartnerships()
      .then((data) => setPartnerships(data))
      .catch((err) => setMessage({ ok: false, text: err instanceof Error ? err.message : at('admin.promos.errors.loadPartnerships', 'Failed to load partnerships.', 'Не вдалося завантажити партнерства.') }))
      .finally(() => setPartnershipsLoading(false));
  };

  useEffect(() => {
    load();
    loadPartnerships();
  }, []);

  // Ne: Create form verisini promo create payload'una cevirir.
  // Nasil: Uncontrolled formdan FormData okur; partnership zorunlu, bos optional alanlari payload'a eklemez.
  // Neden: valid_from/valid_until/usage_limit_total bos birakildiginda backend default ve nullable davranisini korusun.
  const buildCreatePayload = (form: HTMLFormElement): { payload?: CreatePromoPayload; error?: string } => {
    const formData = new FormData(form);
    const code = String(formData.get('code') || '').trim().toUpperCase();
    const partnershipUID = String(formData.get('partnership_uid') || '').trim();
    const discountValue = Number(formData.get('discount_value'));
    const validFrom = readOptionalIso(formData.get('valid_from'));
    const validUntil = readOptionalIso(formData.get('valid_until'));
    const usageLimitTotal = readOptionalNumber(formData.get('usage_limit_total'));

    if (!code) return { error: at('admin.promos.errors.codeRequired', 'Code is required.', 'Потрібно вказати код.') };
    if (!partnershipUID) return { error: at('admin.promos.errors.partnershipRequired', 'Partnership is required.', 'Потрібно обрати партнерство.') };
    if (!Number.isFinite(discountValue) || discountValue <= 0) return { error: at('admin.promos.errors.discountGreaterThanZero', 'Discount value must be greater than 0.', 'Значення знижки має бути більше 0.') };
    if (usageLimitTotal !== undefined && usageLimitTotal <= 0) return { error: at('admin.promos.errors.usageLimitGreaterThanZero', 'Usage limit must be greater than 0.', 'Ліміт використань має бути більше 0.') };

    return {
      payload: {
        code,
        partnership_uid: partnershipUID,
        discount_type: 'percent',
        discount_value: discountValue,
        ...(validFrom ? { valid_from: validFrom } : {}),
        ...(validUntil ? { valid_until: validUntil } : {}),
        ...(usageLimitTotal !== undefined ? { usage_limit_total: usageLimitTotal } : {}),
        is_active: formData.get('is_active') === 'on',
      },
    };
  };

  // Ne: Edit form verisini promo update payload'una cevirir.
  // Nasil: Partnership select'ini zorunlu okur; optional alanlar bos ise null gonderir, boylece backend alanlari temizleyebilir.
  // Neden: Super admin valid_until, usage limit veya partnership bilgisini sonradan guncelleyebilsin.
  const buildUpdatePayload = (form: HTMLFormElement): { payload?: UpdatePromoPayload; error?: string } => {
    const formData = new FormData(form);
    const code = String(formData.get('code') || '').trim().toUpperCase();
    const partnershipUID = String(formData.get('partnership_uid') || '').trim();
    const discountValue = Number(formData.get('discount_value'));
    const usageLimitTotal = readOptionalNumberOrNull(formData.get('usage_limit_total'));

    if (!code) return { error: at('admin.promos.errors.codeRequired', 'Code is required.', 'Потрібно вказати код.') };
    if (!partnershipUID) return { error: at('admin.promos.errors.partnershipRequired', 'Partnership is required.', 'Потрібно обрати партнерство.') };
    if (!Number.isFinite(discountValue) || discountValue <= 0) return { error: at('admin.promos.errors.discountGreaterThanZero', 'Discount value must be greater than 0.', 'Значення знижки має бути більше 0.') };
    if (usageLimitTotal !== null && usageLimitTotal <= 0) return { error: at('admin.promos.errors.usageLimitGreaterThanZero', 'Usage limit must be greater than 0.', 'Ліміт використань має бути більше 0.') };

    return {
      payload: {
        code,
        partnership_uid: partnershipUID,
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
      setMessage({ ok: false, text: error || at('admin.common.pleaseCheckForm', 'Please check the form.', 'Перевірте форму.') });
      return;
    }

    setSaving(true);
    setMessage({ ok: true, text: at('admin.promos.creating', 'Creating promo...', 'Створення промокоду...') });
    try {
      const promo = await createAdminPromo(payload);
      setPromos((prev) => [promo, ...prev]);
      form.reset();
      setMessage({ ok: true, text: at('admin.promos.created', 'Promo created.', 'Промокод створено.') });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : at('admin.promos.errors.create', 'Failed to create promo.', 'Не вдалося створити промокод.') });
    } finally {
      setSaving(false);
    }
  };

  const onUpdate = async (event: FormEvent<HTMLFormElement>, promo: AdminPromo) => {
    event.preventDefault();
    const { payload, error } = buildUpdatePayload(event.currentTarget);

    if (!payload) {
      setMessage({ ok: false, text: error || at('admin.common.pleaseCheckForm', 'Please check the form.', 'Перевірте форму.') });
      return;
    }

    setBusyByUid((prev) => ({ ...prev, [promo.uid]: true }));
    setMessage({ ok: true, text: at('admin.promos.saving', 'Saving promo...', 'Збереження промокоду...') });
    try {
      const updated = await updateAdminPromo(promo.uid, payload);
      setPromos((prev) => prev.map((item) => (item.uid === promo.uid ? updated : item)));
      setMessage({ ok: true, text: at('admin.promos.saved', 'Promo saved.', 'Промокод збережено.') });
    } catch (err) {
      const text = err instanceof FetchHttpError && err.status === 409
        ? at('admin.promos.errors.usedPartnershipCannotChange', 'Used promo partnership cannot be changed.', 'Партнерство використаного промокоду не можна змінити.')
        : err instanceof Error ? err.message : at('admin.promos.errors.save', 'Failed to save promo.', 'Не вдалося зберегти промокод.');
      setMessage({ ok: false, text });
    } finally {
      setBusyByUid((prev) => ({ ...prev, [promo.uid]: false }));
    }
  };

  const onToggle = async (promo: AdminPromo) => {
    setBusyByUid((prev) => ({ ...prev, [promo.uid]: true }));
    try {
      const updated = await setAdminPromoActive(promo.uid, !promo.is_active);
      setPromos((prev) => prev.map((item) => (item.uid === promo.uid ? updated : item)));
      setMessage({ ok: true, text: updated.is_active ? at('admin.promos.enabled', 'Promo enabled.', 'Промокод активовано.') : at('admin.promos.disabled', 'Promo disabled.', 'Промокод деактивовано.') });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : at('admin.promos.errors.status', 'Failed to update promo status.', 'Не вдалося оновити статус промокоду.') });
    } finally {
      setBusyByUid((prev) => ({ ...prev, [promo.uid]: false }));
    }
  };

  // Ne: Ekrandaki promo kodlarini Excel'de acilabilecek dosya olarak export eder.
  // Nasil: State'teki promo listesinden CSV uretip tarayici download aksiyonunu tetikler.
  // Neden: Super admin code bilgilerini panelden ayrilmadan disari alabilsin.
  const onExportPromos = () => {
    if (promos.length === 0) {
      setMessage({ ok: false, text: at('admin.promos.noExportItems', 'No promos to export.', 'Немає промокодів для експорту.') });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    downloadPromosXlsx(promos, `promo-codes-${today}.xlsx`);
    setMessage({ ok: true, text: at('admin.promos.exported', 'Promo codes exported.', 'Промокоди експортовано.') });
  };

  // Ne: Promo filtre formunu local state'e yazar.
  // Nasil: Uncontrolled formdan code ve partnership_uid okur; code'u trimleyip uppercase'e cevirir.
  // Neden: Backend filtre endpointi gerektirmeden ekrandaki promo listesini hizli suzebilelim.
  const onFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFilters({
      code: String(formData.get('code') || '').trim().toUpperCase(),
      partnershipUID: String(formData.get('partnership_uid') || '').trim(),
    });
  };

  // Ne: Promo filtrelerini temizler.
  // Nasil: Filtre state'ini bos degerlere dondurur; form key'i defaultValue'lari yeniler.
  // Neden: Admin tek tikla tam promo listesine geri donebilsin.
  const clearFilters = () => {
    setFilters({ code: '', partnershipUID: '' });
  };

  // Ne: Promo listesini code ve partnership filtrelerine gore suzer.
  // Nasil: Code'u case-insensitive contains ile, partnership'i uid eslesmesiyle kontrol eder.
  // Neden: Super admin uzun promo listesinde ilgili partner veya kodu hizli bulabilsin.
  const activePartnerships = partnerships.filter((partnership) => partnership.is_active);
  const filteredPromos = promos.filter((promo) => {
    if (filters.code && !promo.code.toUpperCase().includes(filters.code)) return false;
    if (filters.partnershipUID && promoPartnershipUID(promo) !== filters.partnershipUID) return false;
    return true;
  });
  const hasActiveFilters = Boolean(filters.code || filters.partnershipUID);

  return (
    <div className="admin-layout">
      <V2Header />
      <div className="admin-container">
        <AdminPageHeader
          breadcrumbs={[{ label: at('admin.nav.admin', 'Admin', 'Адмін') }, { label: at('admin.promos.title', 'Promos', 'Промокоди') }]}
          title={at('admin.promos.title', 'Promos', 'Промокоди')}
          actions={
            <>
              <button type="button" className="admin-page-header-link" onClick={onExportPromos} disabled={loading || promos.length === 0}>
                <i className="fa-solid fa-file-export" />
                {at('admin.common.import', 'Import', 'Імпорт')}
              </button>
              <Link to="/admin/promos/report" className="admin-page-header-link">
                <i className="fa-solid fa-chart-line" />
                {at('admin.nav.promoReport', 'Promo Report', 'Звіт промокодів')}
              </Link>
              <Link to="/admin/partnerships" className="admin-page-header-link">
                <i className="fa-solid fa-handshake" />
                {at('admin.nav.partnerships', 'Partnerships', 'Партнерства')}
              </Link>
              <Link to="/admin/orders" className="admin-page-header-link">
                <i className="fa-solid fa-receipt" />
                {at('admin.nav.viewOrders', 'View Orders', 'Переглянути замовлення')}
              </Link>
            </>
          }
        />

        <section className="admin-panel-card">
          <h2 className="admin-panel-title">{at('admin.promos.createTitle', 'Create Promo', 'Створити промокод')}</h2>
          <form className="admin-panel-form admin-promo-form" onSubmit={onCreate}>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.promos.code', 'Code', 'Код')}</label>
              <input name="code" className="admin-control-input" placeholder="SUMMER10" disabled={saving} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.promos.partnership', 'Partnership', 'Партнерство')}</label>
              <select name="partnership_uid" className="admin-control-input" disabled={saving || partnershipsLoading || activePartnerships.length === 0}>
                <option value="">
                  {partnershipsLoading
                    ? at('admin.common.loadingPartnerships', 'Loading partnerships...', 'Завантаження партнерств...')
                    : activePartnerships.length === 0
                      ? at('admin.common.noPartnershipsFound', 'No active partnerships found', 'Активних партнерств не знайдено')
                      : at('admin.common.selectPartnership', 'Select partnership', 'Оберіть партнерство')}
                </option>
                {!partnershipsLoading && activePartnerships.map((partnership) => (
                  <option key={partnership.uid} value={partnership.uid}>
                    {partnershipLabel(partnership)}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.promos.discountPercent', 'Discount %', 'Знижка %')}</label>
              <input name="discount_value" type="number" min="1" step="0.01" className="admin-control-input" placeholder={at('admin.promos.discountPlaceholder', 'Discount % (10 = 10%)', 'Знижка % (10 = 10%)')} disabled={saving} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.promos.validFrom', 'Valid From', 'Діє з')}</label>
              <input name="valid_from" type="datetime-local" className="admin-control-input" disabled={saving} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.promos.validUntil', 'Valid Until', 'Діє до')}</label>
              <input name="valid_until" type="datetime-local" className="admin-control-input" disabled={saving} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.promos.usageLimit', 'Usage Limit', 'Ліміт використань')}</label>
              <input name="usage_limit_total" type="number" min="1" className="admin-control-input" placeholder={at('admin.promos.usageLimitPlaceholder', 'Usage limit', 'Ліміт використань')} disabled={saving} />
            </div>
            <div className="admin-promo-create-actions">
              <label className="admin-promo-check">
                <input name="is_active" type="checkbox" defaultChecked disabled={saving} />
                {at('admin.common.active', 'Active', 'Активний')}
              </label>
              <button type="submit" className="admin-save-btn" disabled={saving || partnershipsLoading || activePartnerships.length === 0}>
                {saving ? at('admin.common.creating', 'Creating...', 'Створення...') : at('admin.common.create', 'Create', 'Створити')}
              </button>
            </div>
          </form>
          {message && <p className={message.ok ? 'admin-panel-message-ok' : 'admin-panel-message-error'}>{message.text}</p>}
        </section>

        <section className="admin-panel-card admin-order-filter-card">
          <h2 className="admin-panel-title">{at('admin.promos.filterTitle', 'Filter Promos', 'Фільтр промокодів')}</h2>
          <form className="admin-panel-form" onSubmit={onFilter} key={`${filters.code}-${filters.partnershipUID}`}>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.promos.code', 'Code', 'Код')}</label>
              <input name="code" className="admin-control-input" placeholder={at('admin.promos.filterCodePlaceholder', 'SUMMER10', 'SUMMER10')} defaultValue={filters.code} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.promos.partnership', 'Partnership', 'Партнерство')}</label>
              <select name="partnership_uid" className="admin-control-input" defaultValue={filters.partnershipUID} disabled={partnershipsLoading || partnerships.length === 0}>
                <option value="">
                  {partnershipsLoading
                    ? at('admin.common.loadingPartnerships', 'Loading partnerships...', 'Завантаження партнерств...')
                    : at('admin.common.selectPartnership', 'Select partnership', 'Оберіть партнерство')}
                </option>
                {partnerships.map((partnership) => (
                  <option key={partnership.uid} value={partnership.uid}>
                    {partnershipLabel(partnership)}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="admin-save-btn" disabled={loading}>
              {at('admin.common.apply', 'Apply', 'Застосувати')}
            </button>
            {hasActiveFilters && (
              <button type="button" className="admin-order-filter-clear" onClick={clearFilters}>
                {at('admin.common.clear', 'Clear', 'Очистити')}
              </button>
            )}
          </form>
        </section>

        {loading && <div className="admin-empty">{at('admin.promos.loading', 'Loading promos...', 'Завантаження промокодів...')}</div>}
        {!loading && promos.length === 0 && <div className="admin-empty">{at('admin.promos.empty', 'No promos yet.', 'Промокодів ще немає.')}</div>}
        {!loading && promos.length > 0 && filteredPromos.length === 0 && (
          <div className="admin-empty">
            {hasActiveFilters ? at('admin.promos.noFilteredResults', 'No promos found for these filters.', 'За цими фільтрами промокодів не знайдено.') : at('admin.promos.empty', 'No promos yet.', 'Промокодів ще немає.')}
          </div>
        )}

        {!loading && filteredPromos.length > 0 && (
          <div className="admin-panel-list">
            {filteredPromos.map((promo) => {
              const busy = !!busyByUid[promo.uid];
              const selectedPartnershipUID = promoPartnershipUID(promo);
              return (
                <article key={promo.uid} className="admin-panel-row admin-promo-row">
                  <form className="admin-promo-edit-form" onSubmit={(event) => onUpdate(event, promo)}>
                    <div className="admin-control-group">
                      <label className="admin-control-label">{at('admin.promos.code', 'Code', 'Код')}</label>
                      <input name="code" className="admin-control-input" defaultValue={promo.code} disabled={busy} />
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">{at('admin.promos.partnership', 'Partnership', 'Партнерство')}</label>
                      <select
                        key={`${promo.uid}-${selectedPartnershipUID}-${partnerships.length}`}
                        name="partnership_uid"
                        className="admin-control-input"
                        defaultValue={selectedPartnershipUID}
                        disabled={busy}
                      >
                        <option value="">{at('admin.common.selectPartnership', 'Select partnership', 'Оберіть партнерство')}</option>
                        {selectedPartnershipUID && !activePartnerships.some((partnership) => partnership.uid === selectedPartnershipUID) && (
                          <option value={selectedPartnershipUID}>{promoPartnershipLabel(promo)}</option>
                        )}
                        {activePartnerships.map((partnership) => (
                          <option key={partnership.uid} value={partnership.uid}>
                            {partnershipLabel(partnership)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">{at('admin.promos.discountPercent', 'Discount %', 'Знижка %')}</label>
                      <input name="discount_value" type="number" min="1" step="0.01" className="admin-control-input" defaultValue={promo.discount_value} disabled={busy} />
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">{at('admin.promos.validFrom', 'Valid From', 'Діє з')}</label>
                      <input name="valid_from" type="datetime-local" className="admin-control-input" defaultValue={toDateTimeLocal(promo.valid_from)} disabled={busy} />
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">{at('admin.promos.validUntil', 'Valid Until', 'Діє до')}</label>
                      <input name="valid_until" type="datetime-local" className="admin-control-input" defaultValue={toDateTimeLocal(promo.valid_until)} disabled={busy} />
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">{at('admin.promos.usageLimit', 'Usage Limit', 'Ліміт використань')}</label>
                      <input name="usage_limit_total" type="number" min="1" className="admin-control-input" defaultValue={promo.usage_limit_total ?? ''} disabled={busy} />
                    </div>
                    <div className="admin-promo-meta">
                      <span className={`admin-status-badge ${promo.is_active ? 'fulfilled' : 'cancelled'}`}>
                        {promo.is_active ? at('admin.common.active', 'Active', 'Активний') : at('admin.common.inactive', 'Inactive', 'Неактивний')}
                      </span>
                      <span>{at('admin.promos.partnership', 'Partnership', 'Партнерство')}: {promo.partnership || promo.partnership_uid ? promoPartnershipLabel(promo) : '-'}</span>
                      <span>{at('admin.promos.used', 'Used', 'Використано')}: {promo.usage_count ?? 0}</span>
                      <span>{at('admin.common.from', 'From', 'Від')}: {formatDate(promo.valid_from)}</span>
                      <span>{at('admin.promos.until', 'Until', 'До')}: {formatDate(promo.valid_until)}</span>
                    </div>
                    <div className="admin-promo-actions">
                      <button type="submit" className="admin-save-btn" disabled={busy}>
                        {busy ? at('admin.common.saving', 'Saving...', 'Збереження...') : at('admin.common.save', 'Save', 'Зберегти')}
                      </button>
                      <button type="button" className="admin-promo-toggle-btn" onClick={() => onToggle(promo)} disabled={busy}>
                        {promo.is_active ? at('admin.promos.disable', 'Disable', 'Деактивувати') : at('admin.promos.enable', 'Enable', 'Активувати')}
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
