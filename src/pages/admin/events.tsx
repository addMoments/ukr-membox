import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminEvent, deleteAdminEvent, deleteAdminEventPermanently, getAdminEvents, updateAdminEventActivationDate } from '../../client/admin_event';
import { adminText } from '../../utils/admin_i18n';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import V2Header from '../../v2-components/V2Header';
import '../../v2-styles/AdminPageHeader.css';
import '../../v2-styles/AdminOrders.css';

const at = adminText;

function formatDate(value: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Kalici silme onayi: harf buyuklugu ve fazla bosluk eslesmeyi bozmasin.
function normalizeConfirmName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

// date input "YYYY-MM-DD" ister; backend hem bu bicimi hem RFC3339'u kabul ediyor.
function toDateInputValue(value: string) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

// Ne: Bir event satiri; aktivasyon tarihini duzenler, event'i kapatir, kapatilmis event'i tamamen siler.
// Nasil: Tarih kaydedildiginde backend yeni active_until / storage_until'i de dondurur, satir
//        onunla guncellenir.
// Neden: Bitis tarihlerini DB trigger'i paketin activation_days / storage_days degerine gore
//        hesapliyor; burada tekrar hesaplamak iki yerde ayri kural olurdu.
function EventRow({ event, onChanged, onRemoved }: { event: AdminEvent; onChanged: (next: AdminEvent) => void; onRemoved: (uid: string) => void }) {
  const [dateValue, setDateValue] = useState(toDateInputValue(event.activation_date));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const isClosed = !!event.deleted_at;
  // Host icin aktive olmus event'in tarihi kilitli; admin (2.1d) yine de degistirebilir, once onay alinir.
  const isActivated = !!event.activation_date && new Date(event.activation_date).getTime() <= Date.now();
  const dateLocked = isClosed;

  const saveDate = async () => {
    if (!dateValue) return;
    if (isActivated) {
      const label = event.name || event.uid.slice(0, 8);
      const warning = at(
        'admin.events.dateLiveConfirm',
        `"${label}" is already live. Moving its activation date also moves the date guests can upload until and the storage end date, calculated from the package. Continue?`,
        `«${label}» вже активна. Зміна дати активації також зсуне дату, до якої гості можуть завантажувати, і дату завершення зберігання (за тривалістю пакета). Продовжити?`,
        { label },
      );
      if (!window.confirm(warning)) return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const updated = await updateAdminEventActivationDate(event.uid, dateValue);
      onChanged({ ...event, activation_date: updated.activation_date, active_until: updated.active_until, storage_until: updated.storage_until || event.storage_until });
      setMessage({ ok: true, text: at('admin.events.dateSaved', 'Activation date saved.', 'Дату активації збережено.') });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const label = event.name || event.uid.slice(0, 8);
    const warning = at(
      'admin.events.deleteConfirm',
      `Close "${label}" and permanently delete all its photos and videos? This cannot be undone.`,
      `Закрити «${label}» та назавжди видалити всі його фото й відео? Цю дію не можна скасувати.`,
      { label },
    );
    if (!window.confirm(warning)) return;

    setBusy(true);
    setMessage(null);
    try {
      const res = await deleteAdminEvent(event.uid);
      onChanged({ ...event, deleted_at: new Date().toISOString() });
      setMessage({
        ok: true,
        text: res.already_closed
          ? at('admin.events.alreadyClosed', 'This event was already closed.', 'Цю подію вже закрито.')
          : at('admin.events.deleted', 'Event closed and media deleted.', 'Подію закрито, медіа видалено.'),
      });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusy(false);
    }
  };

  // Ne: Kapatilmis event'i tamamen kaldirir (2.15). Geri donusu yok: onay icin event adi yazilir.
  const removePermanently = async () => {
    // Adsiz event'te onay, kartta gorunen "Untitled event" basligidir (uid parcasi degil).
    const expected = event.name?.trim() || at('admin.events.untitled', 'Untitled event', 'Подія без назви');
    const typed = window.prompt(at(
      'admin.events.purgeConfirm',
      `This permanently removes "${expected}" and everything left of it: albums, guests, guestbook messages, the upload summary and any remaining files. The order stays. This cannot be undone.\n\nType the event name to confirm:`,
      `Це назавжди видалить «${expected}» і все, що від неї залишилося: альбоми, гостей, побажання, підсумок завантажень і решту файлів. Замовлення залишиться. Цю дію не можна скасувати.\n\nВведіть назву події для підтвердження:`,
      { label: expected },
    ));
    if (typed === null) return;
    if (normalizeConfirmName(typed) !== normalizeConfirmName(expected)) {
      setMessage({ ok: false, text: at('admin.events.purgeMismatch', 'The name did not match; nothing was deleted.', 'Назва не збігається; нічого не видалено.') });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await deleteAdminEventPermanently(event.uid);
      onRemoved(event.uid);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
      setBusy(false);
    }
  };

  return (
    <article className="admin-panel-row">
      <div className="admin-panel-row-main">
        <strong>{event.name || at('admin.events.untitled', 'Untitled event', 'Подія без назви')}</strong>
        <span>{event.admin_emails || at('admin.events.noOwner', 'No owner account', 'Без облікового запису власника')}</span>
        <small>
          {at('admin.events.status', 'Status', 'Статус')}: {event.status}
          {isClosed && ` · ${at('admin.events.closed', 'Closed', 'Закрито')} ${formatDate(event.deleted_at)}`}
        </small>
      </div>

      <div className="admin-panel-row-meta">
        <span>{at('admin.common.created', 'Created', 'Створено')}: {formatDate(event.created_at)}</span>
        <span>{at('admin.events.activeUntil', 'Active until', 'Активна до')}: {formatDate(event.active_until)}</span>
        <span>{at('admin.events.storageUntil', 'Storage until', 'Зберігання до')}: {formatDate(event.storage_until)}</span>
        <span>
          <input
            type="date"
            className="admin-control-input"
            value={dateValue}
            disabled={dateLocked || busy}
            onChange={(e) => setDateValue(e.target.value)}
          />
          {!dateLocked && (
            <button type="button" className="admin-save-btn" onClick={saveDate} disabled={busy || !dateValue}>
              {at('admin.events.saveDate', 'Save date', 'Зберегти дату')}
            </button>
          )}
        </span>
        {isActivated && !isClosed && (
          <small>
            {at(
              'admin.events.dateLive',
              'Already live — changing the date also moves the upload and storage end dates.',
              'Вже активна — зміна дати також зсуне кінець завантажень і зберігання.',
            )}
          </small>
        )}
        {message && <small className={message.ok ? 'admin-panel-message-ok' : 'admin-panel-message-error'}>{message.text}</small>}
      </div>

      {!isClosed && (
        <button type="button" className="admin-panel-delete-btn" onClick={remove} disabled={busy}>
          {at('admin.events.delete', 'Close event', 'Закрити подію')}
        </button>
      )}
      {isClosed && (
        <button type="button" className="admin-panel-delete-btn" onClick={removePermanently} disabled={busy}>
          {at('admin.events.purge', 'Delete permanently', 'Видалити назавжди')}
        </button>
      )}
    </article>
  );
}

function AdminEvents() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback((term: string) => {
    setLoading(true);
    setError('');
    getAdminEvents(term)
      .then((rows) => setEvents(rows))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    load(search.trim());
  };

  const onRowChanged = (next: AdminEvent) => {
    setEvents((prev) => prev.map((item) => (item.uid === next.uid ? next : item)));
  };

  const [removedNote, setRemovedNote] = useState('');
  const onRowRemoved = (uid: string) => {
    const removed = events.find((item) => item.uid === uid);
    setEvents((prev) => prev.filter((item) => item.uid !== uid));
    setRemovedNote(at(
      'admin.events.purged',
      `"${removed?.name || uid.slice(0, 8)}" was deleted permanently. Its order is still listed under Orders.`,
      `«${removed?.name || uid.slice(0, 8)}» видалено назавжди. Замовлення залишається в розділі «Замовлення».`,
      { label: removed?.name || uid.slice(0, 8) },
    ));
  };

  return (
    <div className="admin-layout">
      <V2Header />
      <div className="admin-container">
        <AdminPageHeader
          breadcrumbs={[{ label: at('admin.nav.admin', 'Admin', 'Адмін') }, { label: at('admin.events.title', 'Events', 'Події') }]}
          title={at('admin.events.title', 'Events', 'Події')}
          actions={
            <>
              <Link to="/admin/orders" className="admin-page-header-link">
                <i className="fa-solid fa-receipt" />
                {at('admin.nav.viewOrders', 'View Orders', 'Переглянути замовлення')}
              </Link>
              <Link to="/admin/products" className="admin-page-header-link">
                <i className="fa-solid fa-boxes-stacked" />
                {at('admin.nav.manageProducts', 'Manage Products', 'Керувати продуктами')}
              </Link>
              <Link to="/admin/promos" className="admin-page-header-link">
                <i className="fa-solid fa-ticket" />
                {at('admin.nav.promos', 'Promos', 'Промокоди')}
              </Link>
            </>
          }
        />

        <section className="admin-panel-card">
          <h2 className="admin-panel-title">{at('admin.events.searchTitle', 'Find an event', 'Знайти подію')}</h2>
          <form className="admin-panel-form" onSubmit={onSearch}>
            <input
              className="admin-control-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={at('admin.events.searchPlaceholder', 'Event name or owner email', 'Назва події або email власника')}
            />
            <button type="submit" className="admin-save-btn" disabled={loading}>
              {at('admin.common.search', 'Search', 'Пошук')}
            </button>
          </form>
          {error && <p className="admin-panel-message-error">{error}</p>}
          {removedNote && <p className="admin-panel-message-ok">{removedNote}</p>}
        </section>

        {loading && <div className="admin-empty">{at('admin.events.loading', 'Loading events...', 'Завантаження подій...')}</div>}

        {!loading && events.length === 0 && !error && (
          <div className="admin-empty">{at('admin.events.empty', 'No events found.', 'Подій не знайдено.')}</div>
        )}

        {!loading && events.length > 0 && (
          <div className="admin-panel-list">
            {events.map((event) => (
              <EventRow key={event.uid} event={event} onChanged={onRowChanged} onRemoved={onRowRemoved} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminEvents;
