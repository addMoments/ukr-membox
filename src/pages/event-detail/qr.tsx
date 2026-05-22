import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import EventDetailLayout from '../../v2-partials/EventDetailLayout';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import FileInput from '../../components/FileInput';
import { eventQrImageUrl } from '../../types/events';
import { uploadQrLogo } from '../../client/uploads';
import { fetch } from '../../client/core';
import { SERV_ROOT } from '../../consts';
import '../../v2-styles/QR.css';
import '../../v2-styles/qrpageprint.css';
import Button from '../../components/Button';
import { saveUrl } from '../../utils/download';
import { t } from '../../packages/i18n';
import { get_key, set_key } from '../../utils/persistence';

type PatternType = 'circle' | 'liquidblock' | 'rectangle' | 'dots';

interface QrSettings {
  fgColor: string;
  bgColor: string;
  activePattern: PatternType;
  noLogo: boolean;
}

const DEFAULT_SETTINGS: QrSettings = {
  fgColor: '#2D2926',
  bgColor: '#FFFFFF',
  activePattern: 'circle',
  noLogo: false,
};

function qrSettingsKey(packedUid: string) {
  return `qr-settings-${packedUid}`;
}

function EventQR() {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const [file, setFile] = useState<File | null>(null);
  const [fgColor, setFgColor] = useState(DEFAULT_SETTINGS.fgColor);
  const [bgColor, setBgColor] = useState(DEFAULT_SETTINGS.bgColor);
  const [activePattern, setActivePattern] = useState<PatternType>(DEFAULT_SETTINGS.activePattern);
  const [noLogo, setNoLogo] = useState(DEFAULT_SETTINGS.noLogo);
  const [previewTimestamp, setPreviewTimestamp] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoPathRef = useRef<string | null>(null);

  // Restore saved settings on mount
  useEffect(() => {
    if (!packedUid) return;
    get_key(qrSettingsKey(packedUid))
      .then((saved: QrSettings) => {
        const settings = saved ? {
          fgColor: saved.fgColor ?? DEFAULT_SETTINGS.fgColor,
          bgColor: saved.bgColor ?? DEFAULT_SETTINGS.bgColor,
          activePattern: saved.activePattern ?? DEFAULT_SETTINGS.activePattern,
          noLogo: saved.noLogo ?? DEFAULT_SETTINGS.noLogo,
        } : DEFAULT_SETTINGS;
        setFgColor(settings.fgColor);
        setBgColor(settings.bgColor);
        setActivePattern(settings.activePattern);
        setNoLogo(settings.noLogo);
        generateQR({ fgColor: settings.fgColor, bgColor: settings.bgColor, shape: settings.activePattern, noLogo: settings.noLogo });
      })
      .catch(() => {
        generateQR({ fgColor: DEFAULT_SETTINGS.fgColor, bgColor: DEFAULT_SETTINGS.bgColor, shape: DEFAULT_SETTINGS.activePattern, noLogo: DEFAULT_SETTINGS.noLogo });
      })
      .finally(() => setSettingsLoaded(true));

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [packedUid]);

  const saveSettings = (settings: QrSettings) => {
    if (packedUid) set_key(qrSettingsKey(packedUid), settings).catch(() => {});
  };

  const generateQR = async (params: { fgColor: string; bgColor: string; shape: PatternType; noLogo: boolean }) => {
    setLoading(true);
    try {
      const body: Record<string, string> = {
        fgColor: params.fgColor,
        bgColor: params.bgColor,
        shape: params.shape,
      };
      if (logoPathRef.current && !params.noLogo) {
        body.logo = logoPathRef.current;
      }
      await fetch(`${SERV_ROOT}/api/qr/${packedUid}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setPreviewTimestamp(Date.now());
    } finally {
      setLoading(false);
    }
  };

  // latest values ref so debounced callback always reads current state
  const latestRef = useRef({ fgColor, bgColor, activePattern, noLogo });
  latestRef.current = { fgColor, bgColor, activePattern, noLogo };

  const scheduleGenerate = (delay = 600) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const { fgColor, bgColor, activePattern, noLogo } = latestRef.current;
      generateQR({ fgColor, bgColor, shape: activePattern, noLogo });
    }, delay);
  };

  const getColorName = (hex: string) => {
    const colorNames: Record<string, string> = {
      '#2D2926': t('qr.colors.jetBlack'),
      '#FFFFFF': t('qr.colors.pureWhite'),
      '#000000': t('qr.colors.black'),
      '#1C1917': t('qr.colors.darkCharcoal'),
      '#DAE0FC': t('qr.colors.lightLavender'),
    };
    return colorNames[hex.toUpperCase()] || t('qr.colors.custom');
  };

  return (
    <EventDetailLayout>
      {(event) => (
        <>
          <AdminPageHeader
            breadcrumbs={[
              { label: t('common.events'), to: '/events' },
              { label: event.name || t('common.event'), to: `/event/${packedUid}` },
              { label: t('qr.breadcrumb') },
            ]}
            title={t('qr.title')}
          />

          {/* Header with actions */}
          <div className="qr-header">
            <p className="qr-header-subtitle">{t('qr.subtitle')}</p>
            <div className="qr-header-actions">
              <Button
                loading={loading}
                icon="fa-solid fa-check"
                text={t('qr.update')}
                type="button"
                onClick={() => scheduleGenerate(0)}
              />
            </div>
          </div>

          <div className="qr-page-layout">
            {/* Left Column - Settings */}
            <div className="qr-settings-column">
              {/* QR Colors Section */}
              <section className="qr-section">
                <div className="qr-section-header">
                  <div className="qr-section-icon colors">
                    <i className="fa-solid fa-palette" />
                  </div>
                  <h2 className="qr-section-title">{t('qr.colors.title')}</h2>
                </div>
                <div className="qr-color-grid">
                  <div className="qr-color-field">
                    <label className="qr-color-label">{t('qr.colors.foreground')}</label>
                    <div className="qr-color-input-wrapper">
                      {settingsLoaded && (
                        <input
                          key={`fg-${fgColor}`}
                          type="color"
                          defaultValue={fgColor}
                          onBlur={(e) => {
                            setFgColor(e.target.value);
                            saveSettings({ ...latestRef.current, fgColor: e.target.value });
                            scheduleGenerate(0);
                          }}
                        />
                      )}
                      <div className="qr-color-info">
                        <p className="qr-color-name">{getColorName(fgColor)}</p>
                        <p className="qr-color-hex">{fgColor.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="qr-color-field">
                    <label className="qr-color-label">{t('qr.colors.background')}</label>
                    <div className="qr-color-input-wrapper">
                      {settingsLoaded && (
                        <input
                          key={`bg-${bgColor}`}
                          type="color"
                          defaultValue={bgColor}
                          onBlur={(e) => {
                            setBgColor(e.target.value);
                            saveSettings({ ...latestRef.current, bgColor: e.target.value });
                            scheduleGenerate(0);
                          }}
                        />
                      )}
                      <div className="qr-color-info">
                        <p className="qr-color-name">{getColorName(bgColor)}</p>
                        <p className="qr-color-hex">{bgColor.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* QR Pattern Section */}
              <section className="qr-section">
                <div className="qr-section-header">
                  <div className="qr-section-icon pattern">
                    <i className="fa-solid fa-table-cells-large" />
                  </div>
                  <h2 className="qr-section-title">{t('qr.pattern.title')}</h2>
                </div>
                <div className="qr-pattern-grid">
                  {(['circle', 'liquidblock', 'rectangle', 'dots'] as PatternType[]).map((p) => {
                    const icons: Record<PatternType, string> = {
                      circle: 'fa-solid fa-circle',
                      liquidblock: 'fa-solid fa-bezier-curve',
                      rectangle: 'fa-solid fa-square',
                      dots: 'fa-solid fa-braille',
                    };
                    const labels: Record<PatternType, string> = {
                      circle: t('qr.pattern.circle'),
                      liquidblock: t('qr.pattern.liquidBlock'),
                      rectangle: t('qr.pattern.rectangle'),
                      dots: t('qr.pattern.dots'),
                    };
                    return (
                      <button
                        key={p}
                        type="button"
                        className={`qr-pattern-btn ${activePattern === p ? 'active' : ''}`}
                        onClick={() => {
                          setActivePattern(p);
                          saveSettings({ ...latestRef.current, activePattern: p });
                          scheduleGenerate(0);
                        }}
                      >
                        <i className={icons[p]} />
                        {labels[p]}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Custom Logo Section */}
              <section className="qr-section">
                <div className="qr-section-header">
                  <div className="qr-section-icon logo">
                    <i className="fa-solid fa-image" />
                  </div>
                  <h2 className="qr-section-title">{t('qr.logo.title')}</h2>
                </div>
                <FileInput
                  name="logo"
                  onFile={async (x) => {
                    setFile(x);
                    setTimeout(() => {
                      const el = document.getElementById('selectedLogo');
                      if (el && el.getAttribute('src')) URL.revokeObjectURL(el.getAttribute('src')!);
                      el?.setAttribute('src', URL.createObjectURL(x));
                    }, 200);
                    const urls = await uploadQrLogo(x);
                    logoPathRef.current = urls[0];
                    scheduleGenerate(0);
                  }}
                  mimeTypes={['image/png', 'image/jpeg', 'image/svg+xml']}
                  multiple={false}
                  className={file && !noLogo ? 'qr-upload-preview' : 'qr-upload-area'}
                >
                  {file && !noLogo ? (
                    <>
                      <img id="selectedLogo" alt="Logo preview" />
                      <div className="qr-upload-preview-info">
                        <p className="qr-upload-preview-name">{file.name}</p>
                        <span className="qr-upload-preview-change">{t('qr.logo.changeFile')}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="qr-upload-icon">
                        <i className="fa-solid fa-cloud-upload-alt" />
                      </div>
                      <h3 className="qr-upload-title">{t('qr.logo.uploadTitle')}</h3>
                      <p className="qr-upload-subtitle">{t('qr.logo.uploadSubtitle')}</p>
                      <span className="qr-upload-btn">{t('qr.logo.browseFiles')}</span>
                    </>
                  )}
                </FileInput>
                <div className="qr-no-logo-option">
                  <input
                    type="checkbox"
                    id="noLogo"
                    checked={noLogo}
                    onChange={(e) => {
                      setNoLogo(e.target.checked);
                      saveSettings({ ...latestRef.current, noLogo: e.target.checked });
                      scheduleGenerate(0);
                    }}
                  />
                  <label htmlFor="noLogo">{t('qr.logo.noLogo')}</label>
                </div>
              </section>
            </div>

            {/* Right Column - Preview */}
            <div className="qr-preview-column">
              <div className="qr-preview-wrapper">
                <div className="qr-preview-badge">
                  <span className="qr-preview-badge-dot"></span>
                  {t('qr.preview.livePreview')}
                </div>
                <div className="qr-preview-card">
                  <h3 className="qr-preview-title">{t('qr.preview.joinParty')}</h3>
                  <p className="qr-preview-subtitle">{t('qr.preview.scanToShare')}</p>
                  <div className="qr-preview-code-container">
                    {event.uid ? (
                      <img
                        src={eventQrImageUrl(event) + (previewTimestamp ? '?t=' + previewTimestamp : '')}
                        alt={t('qr.preview.qrCodePreview')}
                        id="qr-code-preview"
                      />
                    ) : (
                      <div className="qr-preview-placeholder">
                        <i className="fa-solid fa-qrcode" />
                        <span>{t('qr.preview.qrCodePreview')}</span>
                      </div>
                    )}
                  </div>
                  <div className="qr-preview-actions">
                    <button
                      type="button"
                      className="qr-download-btn primary"
                      onClick={() => {
                        const url = eventQrImageUrl(event) + (previewTimestamp ? '?t=' + previewTimestamp : '?t=' + Date.now());
                        saveUrl(url, 'qr-code.png').catch(() => {
                          window.open(url, '_blank');
                        });
                      }}
                    >
                      <i className="fa-solid fa-download" />
                      {t('qr.preview.downloadPng')}
                    </button>
                    <button type="button" className="qr-download-btn secondary" onClick={window.print}>
                      <i className="fa-solid fa-print" />
                      {t('qr.preview.printPdf')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </EventDetailLayout>
  );
}

export default EventQR;
