import { useEffect, useState } from 'react';
import { adminThemes, defaultGuestTheme, getFormName, GuestTheme } from '../types/guestTheme';
import { fonts } from '../types/fonts';
import { put_form_state } from '../utils/form_event_parse';
import { t } from '../packages/i18n';
import '../v2-styles/Theme.css';

interface ThemeCustomizerProps {
  initialColors: GuestTheme;
  initialFont: string;
  onThemeChange?: (theme: GuestTheme) => void;
  onFontChange?: (fontId: string) => void;
  formId?: string;
  showPresets?: boolean;
  showTypography?: boolean;
  showColorPalette?: boolean;
}

function ThemeCustomizer({
  initialColors,
  initialFont,
  onThemeChange,
  onFontChange,
  formId = 'theme-palette-form',
  showPresets = true,
  showTypography = true,
  showColorPalette = true,
}: ThemeCustomizerProps) {
  const [theme, setTheme] = useState<GuestTheme>(initialColors);
  const [activeFont, setActiveFont] = useState(initialFont);

  const applyPreset = (presetTag: string) => {
    const preset = adminThemes.find(t => t.tag === presetTag);
    if (!preset) return;
    put_form_state(document.getElementById(formId) as HTMLFormElement, preset.colors);
    Object.keys(preset.colors).forEach(key => {
      handleColorChange(key, preset.colors[key]);
    });
    setTheme(preset.colors);
    onThemeChange?.(preset.colors);
  };

  useEffect(() => {
    fonts.forEach(font => {
      if (!document.getElementById(`font-${font.id}`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = font.url;
        link.id = `font-${font.id}`;
        link.classList.add('theme-font-link');
        document.head.appendChild(link);
      }
    });

    return () => {
      const links = document.querySelectorAll('.theme-font-link');
      links.forEach(link => link.remove());
    };
  }, []);

  const handleColorChange = (key: string, value: string) => {
    const hexEl = document.querySelector(`[data-hex-for="${key}"]`);
    if (hexEl) hexEl.textContent = value.toUpperCase();
  };

  const handleFontSelect = (fontId: string) => {
    setActiveFont(fontId);
    onFontChange?.(fontId);
  };

  return (
    <>
      {showPresets && (
        <section className="theme-section">
          <div className="theme-section-header">
            <div className="theme-section-icon preset">
              <i className="fa-solid fa-wand-magic-sparkles" />
            </div>
            <h2 className="theme-section-title">{t('theme.vibePresets')}</h2>
          </div>
          <div className="theme-preset-grid">
            {adminThemes.map(t => (
              <div
                key={t.tag}
                className="theme-preset-card"
                onClick={() => applyPreset(t.tag)}
              >
                <div className="theme-preset-box" style={{ backgroundColor: t.displayColor }}>
                  <span style={{ color: t.displayColor }} className="theme-preset-label-inner">
                    {t.tag}
                  </span>
                </div>
                <p className="theme-preset-name">{t.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {showColorPalette && (
        <section className="theme-section">
          <div className="theme-section-header">
            <div className="theme-section-icon palette">
              <i className="fa-solid fa-palette" />
            </div>
            <h2 className="theme-section-title">{t('theme.adjustVibe')}</h2>
          </div>
          <form id={formId} className="theme-palette-grid" key={initialColors ? 'loaded' : 'default'}>
            {Object.keys(defaultGuestTheme).map((key) => (
              <div className="theme-color-field" key={key}>
                <label className="theme-color-label">{getFormName(key)}</label>
                <div className="theme-color-input-wrapper">
                  <div className="theme-color-input-wrapper-inner">
                    <input
                      type="color"
                      name={key}
                      defaultValue={initialColors[key]}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      onBlur={(e) => {
                        const newTheme = { ...theme, [key]: e.target.value };
                        setTheme(newTheme);
                        onThemeChange?.(newTheme);
                      }}
                    />
                  </div>
                  <div className="theme-color-info">
                    <p className="theme-color-hex" data-hex-for={key}>
                      {initialColors[key].toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </form>
        </section>
      )}

      {showTypography && (
        <section className="theme-section">
          <div className="theme-section-header">
            <div className="theme-section-icon typography">
              <i className="fa-solid fa-font" />
            </div>
            <h2 className="theme-section-title">{t('theme.typography')}</h2>
          </div>
          <div className="theme-font-buttons">
            {fonts.map((font) => (
              <button
                key={font.id}
                type="button"
                className={`theme-font-btn ${activeFont === font.id ? 'active' : ''}`}
                onClick={() => handleFontSelect(font.id)}
              >
                {font.name}
              </button>
            ))}
          </div>
          <div
            className="theme-font-preview"
            style={{ fontFamily: fonts.find(f => f.id === activeFont)?.fontFamily }}
          >
            <p className="theme-font-preview-label">{t('theme.previewText')}</p>
            <h3>{t('theme.previewHeadline')}</h3>
            <p>{t('theme.previewSubtext')}</p>
          </div>
        </section>
      )}
    </>
  );
}

export default ThemeCustomizer;
