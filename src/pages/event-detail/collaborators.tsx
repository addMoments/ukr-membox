import { useParams } from 'react-router-dom';
import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import '../../v2-styles/Collaborators.css';
import { parse_submit_event } from '../../utils/form_event_parse';
import { fetch } from '../../client/core';
import { SERV_ROOT } from '../../consts';
import { useCallback, useEffect, useState } from 'react';
import { pgREST } from '../../client/postgrest';
import { get_key, set_key } from '../../utils/persistence';
import { Event } from '../../types/events';
import { t } from '../../packages/i18n';
import { packUUID } from '../../packages/uuid';
import { dbWhoAmI } from '../../client/auth';

interface Collaborator {
  uid: string;
  name: string;
  mail: string;
  is_active: boolean;
}

/**
 * Henüz kabul edilmemiş davet e-postalarının IndexedDB anahtarı (etkinlik bazlı).
 * Tek global `pend-collab` kullanıldığında bir etkinliğe gönderilen davet, diğer tüm etkinliklerin Collaborators ekranında da görünüyordu.
 */
function pendingCollabStorageKey(packedUid: string | undefined): string {
  return packedUid ? `pend-collab-${packedUid}` : 'pend-collab';
}

function EventCollaboratorsInner({ event }: { event: Event }) {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selfUid, setSelfUid] = useState<string | null>(null);
  const [showInviteToast, setShowInviteToast] = useState(false);

  useEffect(() => {
    dbWhoAmI().then(setSelfUid).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showInviteToast) return;
    const timer = window.setTimeout(() => setShowInviteToast(false), 2600);
    return () => window.clearTimeout(timer);
  }, [showInviteToast]);

  /**
   * Bu etkinliğin gerçek üyelerini (admins) çeker; tarayıcıda tutulan pending davetleri sadece bu etkinliğin anahtarından ekler.
   */
  const update = useCallback(async (admins: string[]) => {
    if (!admins || admins.length === 0) return;

    const collabData = await pgREST(`/users?uid=in.(${admins.join(',')})&select=uid,name,mail,is_active`);
    const ownerUid = admins[0];
    collabData.sort((a: Collaborator, b: Collaborator) => {
      if (a.uid === ownerUid) return -1;
      if (b.uid === ownerUid) return 1;
      return Number(b.is_active) - Number(a.is_active);
    });

    const pendKey = pendingCollabStorageKey(packedUid);
    const pendingMails = await get_key(pendKey).catch(() => []);

    // Kabul edilmiş kullanıcılar artık bu etkinliğin admins listesinde; pending listesinden çıkar.
    const realMails = new Set(collabData.map((c: Collaborator) => c.mail?.toLowerCase()));
    const stillPending = pendingMails.filter((mail: string) => !realMails.has(mail.toLowerCase()));
    if (stillPending.length !== pendingMails.length) {
      await set_key(pendKey, stillPending);
    }

    stillPending.forEach((mail: string, i: number) => {
      collabData.push({
        uid: `pend-${i}`,
        name: mail,
        mail,
        is_active: false,
      });
    });

    setCollaborators(collabData);
  }, [packedUid]);

  /** Sunucuya collaborator daveti gönderir; başarıda pending e-postayı yalnızca bu etkinliğin depolama anahtarına ekler. */
  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = parse_submit_event(e);
    setShowInviteToast(false);
    window.setTimeout(() => setShowInviteToast(true), 0);

    const res = await fetch(`${SERV_ROOT}/auth/collaborator/${packedUid}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    const resdata = await res.json();
    const tkn = resdata.token;

    // Davet bu route'taki etkinlik içindir; pending kayıt da aynı packedUid anahtarına yazılır.
    const pendKey = pendingCollabStorageKey(packedUid);
    const pendMails = await get_key(pendKey).catch(() => []);
    pendMails.push(data.email);
    await set_key(pendKey, pendMails);

    if (tkn) {
      await update(event.admins || []);
    }

    console.log({ tkn });
  };

  // admins veya başka bir etkinliğe geçiş (packedUid) değişince listeyi bu etkinliğin pending anahtarıyla yenile.
  useEffect(() => {
    update(event.admins || []);
  }, [event.admins, update]);

  const isPrimary = selfUid === event.admins[0];
  const isUk = (window.currLng || '').toLowerCase() === 'uk';
  const popupTitleRaw = t('collaborators.invitePopupTitle');
  const popupDescriptionRaw = t('collaborators.invitePopupDescription');
  const popupOkRaw = t('collaborators.invitePopupOk');
  const popupCloseRaw = t('collaborators.invitePopupClose');
  const popupTitle = popupTitleRaw === 'collaborators.invitePopupTitle'
    ? (isUk ? 'Лист успішно надіслано' : 'Email sent successfully')
    : popupTitleRaw;
  const popupDescription = popupDescriptionRaw === 'collaborators.invitePopupDescription'
    ? (isUk ? 'Посилання-запрошення доставлено отримувачу.' : 'The invitation link has been delivered to the recipient.')
    : popupDescriptionRaw;
  const popupOk = popupOkRaw === 'collaborators.invitePopupOk'
    ? (isUk ? 'Гаразд' : 'OK')
    : popupOkRaw;
  const popupClose = popupCloseRaw === 'collaborators.invitePopupClose'
    ? (isUk ? 'Закрити' : 'Close')
    : popupCloseRaw;

  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: t('common.events'), to: '/events' },
          { label: event.name || t('common.event'), to: `/event/${packedUid}` },
          { label: t('collaborators.breadcrumb') },
        ]}
        title={t('collaborators.title')}
      />

      {/* Invite Section */}
      {isPrimary && <div className="collab-invite-section">
        <div className="collab-invite-header">
          <div className="collab-invite-icon">
            <i className="fa-solid fa-user-plus" />
          </div>
          <h2 className="collab-invite-title">{t('collaborators.inviteTitle')}</h2>
        </div>

        <form className="collab-invite-form" onSubmit={handleInvite}>
          <div className="collab-form-group">
            <label className="collab-form-label" htmlFor="invite-email">{t('collaborators.emailLabel')}</label>
            <input
              type="email"
              id="invite-email"
              className="collab-form-input"
              name="email"
              required
              placeholder={t('collaborators.emailPlaceholder')}
            />
          </div>

          <div className="collab-form-group">
            <label className="collab-form-label">&nbsp;</label>
            <button type="submit" className="collab-invite-btn">{t('collaborators.inviteButton')}</button>
          </div>
        </form>

        <p className="collab-invite-note">
          <i className="fa-solid fa-circle-info" />
          {t('collaborators.inviteNote')}
        </p>
      </div>}

      {showInviteToast && (
        <div className="collab-toast-overlay" onClick={() => setShowInviteToast(false)}>
          <div className="collab-toast" role="status" aria-live="polite" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="collab-toast-close"
              onClick={() => setShowInviteToast(false)}
              aria-label={popupClose}
            >
              <i className="fa-solid fa-xmark" />
            </button>

            <div className="collab-toast-icon">
              <i className="fa-solid fa-circle-check" />
            </div>
            <div className="collab-toast-text">
              <strong>{popupTitle}</strong>
              <span>{popupDescription}</span>
            </div>
            <button
              type="button"
              className="collab-toast-ok"
              onClick={() => setShowInviteToast(false)}
            >
              {popupOk}
            </button>
          </div>
        </div>
      )}

      {/* Team List */}
      <div className="collab-team-section">
        <div className="collab-team-header">
          <h2 className="collab-team-title">{t('collaborators.currentTeam')}</h2>
          <span className="collab-team-count">{collaborators.length} {t('collaborators.members')}</span>
        </div>

        <div className="collab-team-list">
          {collaborators.map((collab) => (
            <div
              key={collab.uid}
              className={`collab-member-row ${!collab.is_active ? 'pending' : ''}`}
            >
              <div className="collab-member-info">
                <div className="collab-member-avatar-placeholder">
                  <i className={`fa-solid ${collab.is_active ? 'fa-user' : 'fa-envelope'}`} />
                </div>
                <div className="collab-member-details">
                  <h3 className="collab-member-name">
                    {collab.is_active ? collab.name : collab.mail}
                  </h3>
                  <p className="collab-member-email">
                    {collab.is_active ? collab.mail : t('collaborators.invitationPending')}
                  </p>
                </div>
              </div>

              <div className="collab-member-meta">
                <div className={`collab-status ${collab.is_active ? 'active' : 'pending'}`}>
                  <span className="collab-status-dot" />
                  {collab.is_active ? t('collaborators.statusActive') : t('collaborators.statusPending')}
                </div>

                {collab.uid === event.admins[0] ? (
                  <span className="collab-primary-label">{t('collaborators.primary')}</span>
                ) : isPrimary && !collab.is_active ? (
                  <div className="collab-pending-actions">
                    <button
                      className="collab-action-btn cancel"
                      onClick={async () => {
                        const pendKey = pendingCollabStorageKey(packedUid);
                        const pendMails = await get_key(pendKey).catch(() => []);
                        const updated = pendMails.filter((m: string) => m !== collab.mail);
                        await set_key(pendKey, updated);
                        await update(event.admins || []);
                      }}
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                ) : isPrimary ? (
                  <div className="collab-actions">
                    <button
                      className="collab-action-btn delete"
                      onClick={async () => {
                        try {
                          await fetch(`${SERV_ROOT}/auth/collaborator/${packedUid}/${packUUID(collab.uid)}`, {
                            method: 'DELETE',
                          });
                          await update(event.admins.filter(uid => uid !== collab.uid));
                        } catch {
                          alert('Could not remove collaborator.');
                        }
                      }}
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

      </div>
    </>
  );
}

function EventCollaborators() {
  return (
    <EventDetailLayout>
      {(event) => (
        <EventCollaboratorsInner event={event} />
      )}
    </EventDetailLayout>
  );
}

export default EventCollaborators;
