import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import EventHomeContent from '../../partials/EventHomeContent';

function EventDetail() {
  return (
    <EventDetailLayout>
      {(event) => {
        return <EventHomeContent event={event} />;
      }}
    </EventDetailLayout>
  );
}

export default EventDetail;
