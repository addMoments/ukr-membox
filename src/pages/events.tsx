import { useEffect } from 'react';
import { pgErr } from '../client/postgrest';
import { packUUID } from '../packages/uuid';
import { useNavigate } from 'react-router-dom';
import { ADMIN_NO_ACCESS_PATH, getAdminRoleOrEmpty, isFormerPanelAdminWithoutActiveEvent } from '../client/admin';

const Events = () => {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      // Admin kullanicilari event listesi yerine admin panel girisine alinir.
      const adminRole = await getAdminRoleOrEmpty({ forceRefresh: true });
      if (adminRole.is_admin) {
        navigate('/admin/orders');
        return;
      }
      // Eski panel admin olup aktif eventi olmayan kullanici services/prices akisana dusmemeli.
      if (isFormerPanelAdminWithoutActiveEvent(adminRole)) {
        navigate(ADMIN_NO_ACCESS_PATH);
        return;
      }

      const { res: evts, err } = await pgErr(`/events?deleted_at=is.null&order=created_at.desc`);
      if (err) {
        navigate('/signin');
        return;
      }

      const visibleEvents = Array.isArray(evts) ? evts.filter((evt) => !evt.deleted_at) : [];

      if (visibleEvents.length === 0) {
        navigate('/events/services-and-prices/');
        return;
      }

      navigate(`/event/${packUUID(visibleEvents[0].uid)}`);
    })();
  }, [navigate]);

  return <></>;
};

export default Events;
