import { ChangeEvent, useEffect, useRef, useState } from 'react';
import SettingsFieldNote from './SettingsFieldNote';
import { textOr } from '../utils/admin_i18n';
import {
  WELCOME_MAX_CHARS,
  WELCOME_MAX_LINES,
  countWelcomeLines,
  loadWelcomeFont,
} from '../utils/welcomeMessage';

interface WelcomeMessageFieldProps {
  name: string;
  label: string;
  placeholder: string;
  initialValue: string;
  // Misafir sayfasinin yazi tipi (events.settings.font); satirlar o yazi tipiyle olculur.
  fontId?: string;
}

// Ne: Ayarlardaki karsilama metni alani ve misafir sayfasinda kac satir tutacaginin sayaci.
// Nasil: Her degisiklik misafir sayfasindaki olcuyle sayilir (utils/welcomeMessage). 3 satiri asan
//        metin kabul edilir; misafir ilk 3 satiri ve "Більше" baglantisini gorur (V2GuestHome).
// Neden: 16 Ekim'de metin 3 satirla sinirlanmisti; musteri 2 Kasim'da asil istegin 3 satirin
//        gorunmesi, fazlasinin "Show more" ile acilmasi oldugunu yazdi.
function WelcomeMessageField({ name, label, placeholder, initialValue, fontId }: WelcomeMessageFieldProps) {
  const [value, setValue] = useState(initialValue);
  const [lines, setLines] = useState(() => countWelcomeLines(initialValue, fontId));
  const valueRef = useRef(value);
  valueRef.current = value;

  // Yazi tipi yuklenince olcu degisebilir; sayac yeniden hesaplanir.
  useEffect(() => {
    let alive = true;
    loadWelcomeFont(fontId).then(() => {
      if (alive) setLines(countWelcomeLines(valueRef.current, fontId));
    });
    return () => { alive = false; };
  }, [fontId]);

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    setLines(countWelcomeLines(next, fontId));
  };

  const collapsed = lines > WELCOME_MAX_LINES;

  return (
    <div className="settings-field full-width">
      <label className="settings-field-label">{label}</label>
      <textarea
        name={name}
        className="settings-field-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={WELCOME_MAX_CHARS}
        rows={4}
      />
      <div className="settings-welcome-counter" aria-live="polite">
        {textOr('settings.generalDetails.welcomeLineCount', 'Lines on the guest page: {{lines}}', 'Рядків на сторінці для гостей: {{lines}}', { lines })}
      </div>
      <SettingsFieldNote>
        <p>
          {textOr(
            'settings.generalDetails.welcomeShowMoreHelp',
            'Guests see the first {{max}} lines. If the message is longer, a “Show more” link opens the rest.',
            'Гості бачать перші {{max}} рядки. Якщо повідомлення довше, решту відкриває посилання «Більше».',
            { max: WELCOME_MAX_LINES },
          )}
        </p>
        {collapsed && (
          <p>
            {textOr(
              'settings.generalDetails.welcomeCollapsed',
              'This message is longer than {{max}} lines, so guests will see “Show more” under the first {{max}} lines.',
              'Повідомлення довше за {{max}} рядки, тож гості побачать «Більше» після перших {{max}} рядків.',
              { max: WELCOME_MAX_LINES },
            )}
          </p>
        )}
      </SettingsFieldNote>
    </div>
  );
}

export default WelcomeMessageField;
