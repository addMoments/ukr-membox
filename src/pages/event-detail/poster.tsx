import { useState } from 'react';
import { useParams } from 'react-router-dom';
import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import ThemeCustomizer from '../../v2-components/ThemeCustomizer';
import Button from '../../components/Button';
import { defaultGuestTheme, GuestTheme } from '../../types/guestTheme';
import { fonts } from '../../types/fonts';
import { Event } from '../../types/events';
import '../../v2-styles/Theme.css';
import '../../v2-styles/Poster.css';
import '../../v2-styles/QR.css';
import '../../v2-styles/posterprint.css';
import { S3_ROOT } from '../../consts';
import Mockup2 from '../../components/Mockup2';
import GoldenHour from '../../printables/golden-hour';
import { pgREST } from '../../client/postgrest';
import { unpackUUID } from '../../packages/uuid';
import { t } from '../../packages/i18n';
import FeatureGate from '../../v2-components/FeatureGate';
import { FEATURE_POSTER } from '../../utils/features';

function EventPosterInner({ event, features }: { event: Event; features: number[] }) {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const initialColors: GuestTheme = { ...defaultGuestTheme, ...event.settings?.poster_colors };

  const [theme, setTheme] = useState<GuestTheme>(initialColors);
  const [activeFont, setActiveFont] = useState(event.settings?.poster_font || fonts[0].id);
  const [loading, setLoading] = useState(false);

  const posterUrl = S3_ROOT + "/ui/assets/bannerMockup.webp";

  const eventUid = unpackUUID(packedUid || "");
  /* const handleSavePrivacySettings = async (e: React.FormEvent<HTMLFormElement>) => {
    setSaving(true);
    const form = parse_submit_event(e);
    const eventUid = unpackUUID(packedUid || "");

    const newSettings = {
      ...settings,
      ...form
    };

    await pgREST(`/events?uid=eq.${eventUid}`, {
      method: 'PATCH',
      body: JSON.stringify({ settings: newSettings })
    }).finally(() => {
      setSaving(false);
    });
  } */

  const handleSave = async () => {
    setLoading(true);
    // TODO: Save poster settings

    const newSettings = {
      ...event.settings,
      poster_colors: theme,
      poster_font: activeFont,
    };

    await pgREST(`/events?uid=eq.${eventUid}`, {
      method: 'PATCH',
      body: JSON.stringify({ settings: newSettings })
    }).finally(() => {
      setLoading(false);
    });
    
    setLoading(false);
  };

  const handleDiscard = () => {
    console.log('[STUB] Discard changes');
  };

  return (
    <FeatureGate features={features} featureId={FEATURE_POSTER} displayName="Poster Generation">
      <>
        <AdminPageHeader
          breadcrumbs={[
            { label: t('common.events'), to: '/events' },
            { label: event.name || t('common.event'), to: `/event/${packedUid}` },
            { label: t('poster.breadcrumb') },
          ]}
          title={t('poster.title')}
        />

        <div className="print-only">
          <GoldenHour event={event} colorsOverride={theme} fontOverride={activeFont} />
        </div>

        <div className="theme-header">
          <p className="theme-header-subtitle">
            {t('poster.subtitle')}
          </p>
          <div className="theme-header-actions">
            <Button text={t('poster.discard')} variant="secondary" onClick={handleDiscard} />
            <Button loading={loading} icon="fa-solid fa-check" text={t('poster.saveChanges')} onClick={handleSave} />
          </div>
        </div>

        <div className="theme-page-layout">
          <div className="theme-settings-column">
            <ThemeCustomizer
              initialColors={initialColors}
              initialFont={activeFont}
              onThemeChange={setTheme}
              onFontChange={setActiveFont}
              formId="poster-palette-form"
            />
          </div>

          <div className="theme-preview-column">
            <div className="theme-preview-wrapper">
              <div className="theme-preview-badge">
                <span className="theme-preview-badge-dot"></span>
                {t('poster.posterPreview')}
              </div>
              <div className="poster-preview">
                <Mockup2
                  width={280}
                  simulatedWidth={900}
                  noscroll={true}
                  placement={{
                    widthPercent: 434/617*100,
                    heightPercent: 553/684*100,
                    leftPercent: 95/617*100,
                    topPercent: 77/684*100,
                  }}
                  mockupImage={posterUrl}
                >
                  <GoldenHour event={event} colorsOverride={theme} fontOverride={activeFont} />
                </Mockup2>
                <div className="poster-actions">
                  <button onClick={window.print} type="button" className="qr-download-btn secondary">
                    <i className="fa-solid fa-print" />
                    {t('poster.printPdf')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    </FeatureGate>
  );
}

function EventPoster() {
  return (
    <EventDetailLayout>
      {(event, features) => <EventPosterInner event={event} features={features} />}
    </EventDetailLayout>
  );
}

export default EventPoster;
