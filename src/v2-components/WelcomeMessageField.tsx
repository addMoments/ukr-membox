import { ChangeEvent, useEffect, useRef, useState } from 'react';
import SettingsFieldNote from './SettingsFieldNote';
import { textOr } from '../utils/admin_i18n';
import {
  WELCOME_MAX_LINES,
  countWelcomeLines,
  fitWelcomeMessage,
  loadWelcomeFont,
  welcomeFits,
} from '../utils/welcomeMessage';

interface WelcomeMessageFieldProps {
  name: string;
  label: string;
  placeholder: string;
  initialValue: string;
  // Misafir sayfasinin yazi tipi (events.settings.font); satirlar o yazi tipiyle olculur.
  fontId?: string;
}

// Ne: Ayarlardaki karsilama metni alani; misafir sayfasinda 3 satiri asacak girisi kabul etmez.
// Nasil: Her degisiklik misafir sayfasindaki olcuyle sayilir (utils/welcomeMessage). Sona yazilan ya
//        da yapistirilan metin sinira kadar kesilir; ortaya yapilan, siniri asan ekleme reddedilir.
//        Silme her zaman serbest: sinirdan once yazilmis uzun metin adim adim kisaltilabilir.
// Neden: Musteri (16 Ekim) hostun en fazla 3 tam satir kullanabilmesini istedi.
function WelcomeMessageField({ name, label, placeholder, initialValue, fontId }: WelcomeMessageFieldProps) {
  const [value, setValue] = useState(initialValue);
  const [lines, setLines] = useState(() => countWelcomeLines(initialValue, fontId));
  const [rejected, setRejected] = useState(false);
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

  const accept = (next: string) => {
    setValue(next);
    setLines(countWelcomeLines(next, fontId));
  };

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    if (welcomeFits(next, fontId) || next.length < value.length) {
      accept(next);
      setRejected(false);
      return;
    }
    if (next.startsWith(value)) {
      const fitted = fitWelcomeMessage(next, fontId);
      if (fitted.length > value.length) accept(fitted);
    }
    setRejected(true);
  };

  const overLimit = lines > WELCOME_MAX_LINES;

  return (
    <div className="settings-field full-width">
      <label className="settings-field-label">{label}</label>
      <textarea
        name={name}
        className="settings-field-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={3}
      />
      <div className={`settings-welcome-counter${overLimit || rejected ? ' over' : ''}`} aria-live="polite">
        {textOr('settings.generalDetails.welcomeLines', 'Lines: {{lines}} / {{max}}', 'Рядків: {{lines}} / {{max}}', { lines, max: WELCOME_MAX_LINES })}
      </div>
      <SettingsFieldNote>
        <p>
          {textOr(
            'settings.generalDetails.welcomeLimitHelp',
            'Guests see this message on the event page in up to {{max}} lines (about 120 characters), so the title, buttons, promotions and albums fit on one screen.',
            'Гості бачать це повідомлення на сторінці події — не більше {{max}} рядків (близько 120 символів), щоб назва, кнопки, промоції та альбоми вмістилися на одному екрані.',
            { max: WELCOME_MAX_LINES },
          )}
        </p>
        {overLimit && (
          <p>
            {textOr(
              'settings.generalDetails.welcomeTooLong',
              'This message is longer than {{max}} lines: guests see the first {{max}} lines and a “Show more” link. Shorten it to fit.',
              'Повідомлення довше за {{max}} рядки: гості бачать перші {{max}} рядки та посилання «Більше». Скоротіть його, щоб воно вмістилося.',
              { max: WELCOME_MAX_LINES },
            )}
          </p>
        )}
        {rejected && !overLimit && (
          <p>
            {textOr(
              'settings.generalDetails.welcomeRejected',
              'The welcome message can take at most {{max}} lines on the guest page.',
              'Вітальне повідомлення може займати не більше {{max}} рядків на сторінці для гостей.',
              { max: WELCOME_MAX_LINES },
            )}
          </p>
        )}
      </SettingsFieldNote>
    </div>
  );
}

export default WelcomeMessageField;
