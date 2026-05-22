import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import MediaCard from '../../v2-components/MediaCard';
import GalleryFilterBar from '../../v2-components/GalleryFilterBar';
import PhotoViewerModal, { photoViewerState } from '../../partials/PhotoViewerModal';
import { UploadEntry as UploadType } from '../../types/uploads';
import { ParticipantInfo } from '../../types/participant-info';
import { pgREST } from '../../client/postgrest';
import { unpackUUID } from '../../packages/uuid';
import { S3_ROOT } from '../../consts';
import { t } from '../../packages/i18n';
import '../../v2-styles/Gallery.css';

function EventTrash() {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const [uploads, setUploads] = useState<UploadType[]>([]);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    if (!packedUid) return;
    const uid = unpackUUID(packedUid);
    
    Promise.all([
      pgREST(`/uploads?event_uid=eq.${uid}&upload_type=in.(photo,video)&trashed_at=not.is.null&order=trashed_at.desc`),
      pgREST(`/participants?event_uid=eq.${uid}`)
    ]).then(([uploadsData, participantsData]) => {
      setUploads(uploadsData);
      setParticipants(participantsData);
    });
  }, [packedUid]);

  const participantMap = new Map<string, ParticipantInfo>();
  participants.forEach(p => participantMap.set(p.uid, p));

  const filteredUploads = uploads.filter(upload => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'photos') return upload.upload_type === 'photo';
    if (activeFilter === 'videos') return upload.upload_type === 'video';
    return true;
  });

  const handleRestore = (uploadUid: string) => {
    pgREST(`/uploads?uid=eq.${uploadUid}`, {
      method: 'PATCH',
      body: JSON.stringify({ trashed_at: null })
    }).then(() => {
      setUploads(prev => prev.filter(u => u.uid !== uploadUid));
    });
  };

  const handleDeletePermanently = (uploadUid: string) => {
    // TODO: Implement permanent delete functionality
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(t('lang_code'), { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const openPhotoViewer = (uploadUid: string) => {
    const index = filteredUploads.findIndex(u => u.uid === uploadUid);
    photoViewerState.items = filteredUploads.map(upload => {
      const participant = participantMap.get(upload.client_uid);
      const name = participant?.name || t('common.unknown');
      const type = upload.upload_type === 'video' ? t('common.video') : t('common.photo');
      return {
        src: S3_ROOT + upload.value,
        title: name,
        tagline: `${type} on ${formatDate(upload.created_at)}`,
        id: upload.uid,
        isVideo: upload.upload_type === 'video',
      };
    });
    photoViewerState.actions = [
      { icon: 'fa-solid fa-rotate-left', onClick: (id) => handleRestore(id) },
      { icon: 'fa-solid fa-trash', onClick: (id) => handleDeletePermanently(id) },
    ];
    photoViewerState.currentIndex = index >= 0 ? index : 0;
    photoViewerState.open = true;
  };

  return (
    <EventDetailLayout>
      {(event) => (
        <>
          <PhotoViewerModal />
          <AdminPageHeader
            breadcrumbs={[
              { label: t('common.events'), to: '/events' },
              { label: event.name || t('common.event'), to: `/event/${packedUid}` },
              { label: t('trash.breadcrumb') },
            ]}
            title={t('trash.title')}
          />

          <GalleryFilterBar
            activeTab={activeFilter}
            onTabChange={setActiveFilter}
            renderSearch={false}
          />

          {/* Trash Grid */}
          {filteredUploads.length > 0 ? (
            <>
              <div className="gallery-masonry">
                {filteredUploads.map((upload) => {
                  const participant = participantMap.get(upload.client_uid);
                  const name = participant?.name || t('common.unknown');

                  return (
                    <MediaCard
                      onFullscreen={() => openPhotoViewer(upload.uid)}
                      key={upload.uid}
                      uploaderName={name}
                      uploadEntry={upload}
                      actions={[
                        { variant: 'icontext', text: '', icon: 'fa-solid fa-magnifying-glass', onClick: () => openPhotoViewer(upload.uid) },
                        { variant: 'icontext', text: '', icon: 'fa-solid fa-rotate-left', onClick: () => handleRestore(upload.uid) },
                        { variant: 'icontext', text: '', icon: 'fa-solid fa-trash', onClick: () => handleDeletePermanently(upload.uid) },
                      ]}
                    />
                  );
                })}
              </div>

              {/* Load More */}
              <div className="gallery-load-more">
                <button className="gallery-load-more-btn">
                  <i className="fa-solid fa-refresh" />
                  {t('trash.loadMore')}
                </button>
              </div>
            </>
          ) : (
            <div className="gallery-empty">
              <div className="gallery-empty-icon">
                <i className="fa-solid fa-trash" />
              </div>
              <h3 className="gallery-empty-title">{t('trash.emptyTitle')}</h3>
              <p className="gallery-empty-text">{t('trash.emptyText')}</p>
            </div>
          )}
        </>
      )}
    </EventDetailLayout>
  );
}

export default EventTrash;
