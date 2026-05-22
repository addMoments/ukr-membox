import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import MediaCard from '../../v2-components/MediaCard';
import GalleryFilterBar from '../../v2-components/GalleryFilterBar';
import PhotoViewerModal, { photoViewerState } from '../../partials/PhotoViewerModal';
import { UploadEntry as UploadType } from '../../types/uploads';
import { pgREST } from '../../client/postgrest';
import { unpackUUID } from '../../packages/uuid';
import { S3_ROOT } from '../../consts';
import { saveUrl } from '../../utils/download';
import { t } from '../../packages/i18n';
import '../../v2-styles/Gallery.css';

const PAGE_SIZE = 30;
type GalleryFilterType = 'all' | 'photos' | 'videos';
type GalleryUpload = UploadType & { participants?: { name?: string } | { name?: string }[] };

const getUploadTypeQuery = (filter: GalleryFilterType) => {
  if (filter === 'all') return 'in.(photo,video)';
  if (filter === 'photos') return 'eq.photo';
  return 'eq.video';
};

function EventGallery() {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const [uploads, setUploads] = useState<GalleryUpload[]>([]);
  const [activeFilter, setActiveFilter] = useState<GalleryFilterType>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const requestIdRef = useRef(0);
  const filterRef = useRef(activeFilter);
  const sortOrderRef = useRef(sortOrder);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    filterRef.current = activeFilter;
  }, [activeFilter]);

  useEffect(() => {
    sortOrderRef.current = sortOrder;
  }, [sortOrder]);

  const fetchUploadsPage = useCallback(async (
    filter: GalleryFilterType,
    order: 'desc' | 'asc',
    pageOffset: number
  ): Promise<GalleryUpload[]> => {
    if (!packedUid) return [];
    const uid = unpackUUID(packedUid);
    return pgREST(
      `/uploads?event_uid=eq.${uid}&upload_type=${getUploadTypeQuery(filter)}&trashed_at=is.null&order=created_at.${order}&order=uid.${order}&limit=${PAGE_SIZE}&offset=${pageOffset}&select=*,participants(name)`
    );
  }, [packedUid]);

  useEffect(() => {
    if (!packedUid) return;
    (async () => {
      const requestId = ++requestIdRef.current;
      const filter = activeFilter;
      const order = sortOrder;
      const firstPage = await fetchUploadsPage(filter, order, 0);
      if (
        requestId !== requestIdRef.current ||
        filterRef.current !== filter ||
        sortOrderRef.current !== order
      ) {
        return;
      }
      setUploads(firstPage);
      setOffset(firstPage.length);
      setHasMore(firstPage.length === PAGE_SIZE);
    })();
  }, [packedUid, activeFilter, sortOrder, fetchUploadsPage]);

  const handleSortChange = (order: 'desc' | 'asc') => {
    setSortOrder(order);
  };

  const handleLoadMore = async () => {
    if (loadingMore) return;
    if (!hasMore) return;
    setLoadingMore(true);
    try {
      const filter = activeFilter;
      const order = sortOrder;
      const currentOffset = offset;
      const more = await fetchUploadsPage(filter, order, currentOffset);
      if (filterRef.current !== filter || sortOrderRef.current !== order) {
        return;
      }
      setUploads(prev => {
        const seen = new Set(prev.map(item => item.uid));
        const uniqueMore = more.filter(item => !seen.has(item.uid));
        return [...prev, ...uniqueMore];
      });
      setOffset(prev => prev + more.length);
      setHasMore(more.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredUploads = uploads;

  const getUploaderName = (upload: GalleryUpload) => {
    const participant = Array.isArray(upload.participants) ? upload.participants[0] : upload.participants;
    const name = participant?.name?.trim() || '';
    return name || t('common.unknown');
  };

  const handleTrash = (uploadUid: string) => {
    const upload = uploads.find(u => u.uid === uploadUid);
    if (!upload) return;

    pgREST(`/uploads?uid=eq.${uploadUid}`, {
      method: 'PATCH',
      body: JSON.stringify({ trashed_at: new Date().toISOString() })
    }).then(() => {
      setUploads(prev => prev.filter(u => u.uid !== uploadUid));
      photoViewerState.open = false;
      showToast(t('gallery.mediaDeleted'));
    });
  };

  const handleDownload = (uploadUid: string) => {
    const upload = uploads.find(u => u.uid === uploadUid);
    if (!upload) return;
    
    const url = S3_ROOT + upload.value;
    const filename = upload.value.split('/').pop() || 'download';
    saveUrl(url, filename);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(t('lang_code'), { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const openPhotoViewer = (uploadUid: string) => {
    const index = filteredUploads.findIndex(u => u.uid === uploadUid);
    photoViewerState.items = filteredUploads.map(upload => {
      const name = getUploaderName(upload);
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
      { icon: 'fa-solid fa-download', onClick: (id) => handleDownload(id) },
      { icon: 'fa-solid fa-trash', onClick: (id) => handleTrash(id) },
    ];
    photoViewerState.currentIndex = index >= 0 ? index : 0;
    photoViewerState.open = true;
  };

  return (
    <EventDetailLayout>
      {(event) => (
        <>
          <PhotoViewerModal />
          {toast && (
            <div className="gallery-toast">
              <i className="fa-solid fa-check-circle" />
              {toast}
            </div>
          )}
          <AdminPageHeader
            breadcrumbs={[
              { label: t('common.events'), to: '/events' },
              { label: event.name || t('common.event'), to: `/event/${packedUid}` },
              { label: t('gallery.breadcrumb') },
            ]}
            title={t('gallery.title')}
          />

          <GalleryFilterBar
            activeTab={activeFilter}
            onTabChange={(tab) => setActiveFilter(tab as GalleryFilterType)}
            renderSearch={false}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
          />

          {/* Gallery Grid */}
          {filteredUploads.length > 0 ? (
            <>
              <div className="gallery-masonry">
                {filteredUploads.map((upload) => {
                  const name = getUploaderName(upload);

                  return (
                    <MediaCard
                      onFullscreen={() => openPhotoViewer(upload.uid)}
                      key={upload.uid}
                      uploaderName={name}
                      uploadEntry={upload}
                      actions={[
                        { variant: 'icontext', text: '', icon: 'fa-solid fa-magnifying-glass', onClick: () => openPhotoViewer(upload.uid) },
                        { variant: 'icontext', text: '', icon: 'fa-solid fa-download', onClick: () => handleDownload(upload.uid) },
                        { variant: 'icontext', text: '', icon: 'fa-solid fa-trash', onClick: () => handleTrash(upload.uid) },
                      ]}
                    />
                  );
                })}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="gallery-load-more">
                  <button className="gallery-load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>
                    <i className={`fa-solid ${loadingMore ? 'fa-spinner fa-spin' : 'fa-refresh'}`} />
                    {t('gallery.loadMore')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="gallery-empty">
              <div className="gallery-empty-icon">
                <i className="fa-solid fa-image" />
              </div>
              <h3 className="gallery-empty-title">{t('gallery.emptyTitle')}</h3>
              <p className="gallery-empty-text">{t('gallery.emptyText')}</p>
            </div>
          )}
        </>
      )}
    </EventDetailLayout>
  );
}

export default EventGallery;
