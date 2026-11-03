import { FormEvent, useState } from 'react';
import Button from '../components/Button';
import PasswordInput from './PasswordInput';
import SettingsFieldNote from './SettingsFieldNote';
import { fetch, FetchHttpError } from '../client/core';
import { SERV_ROOT } from '../consts';
import { textOr } from '../utils/admin_i18n';

const MIN_PASSWORD_LENGTH = 8;

type Status = { state: 'saving' | 'success' | 'error'; message?: string } | null;

// Ne: Giris yapmis kullanicinin parolasini degistirmesi (mevcut parola + yeni parola iki kez).
// Neden: Musteri 2 Kasim (2.25): parola yalnizca "parolami unuttum" e-postasiyla degisiyordu.
// Not: Kurallar sifirlama akisiyla ayni (en az 8 karakter); sunucu da ayni kontrolleri yapar.
function ChangePasswordSection() {
  const [status, setStatus] = useState<Status>(null);
  const [formKey, setFormKey] = useState(0);

  const errorText = (code: string) => {
    switch (code) {
      case 'WRONG_PASSWORD':
        return textOr('settings.password.wrongCurrent', 'The current password is not correct.', 'Поточний пароль неправильний.');
      case 'PASSWORD_TOO_SHORT':
        return textOr('settings.password.tooShort', 'The new password must be at least {{min}} characters.', 'Новий пароль має містити щонайменше {{min}} символів.', { min: MIN_PASSWORD_LENGTH });
      case 'PASSWORDS_DO_NOT_MATCH':
        return textOr('settings.password.mismatch', 'The new passwords do not match.', 'Нові паролі не збігаються.');
      case 'SAME_PASSWORD':
        return textOr('settings.password.same', 'The new password is the same as the current one.', 'Новий пароль збігається з поточним.');
      case 'REQUIRED':
        return textOr('settings.password.required', 'Please fill in all three fields.', 'Заповніть усі три поля.');
      default:
        return textOr('settings.password.failed', 'Could not change the password. Please try again.', 'Не вдалося змінити пароль. Спробуйте ще раз.');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const current = String(data.get('current_password') || '');
    const next = String(data.get('new_password') || '');
    const confirm = String(data.get('confirm_password') || '');

    let code = '';
    if (!current || !next || !confirm) code = 'REQUIRED';
    else if (next.length < MIN_PASSWORD_LENGTH) code = 'PASSWORD_TOO_SHORT';
    else if (next !== confirm) code = 'PASSWORDS_DO_NOT_MATCH';
    else if (next === current) code = 'SAME_PASSWORD';
    if (code) {
      setStatus({ state: 'error', message: errorText(code) });
      return;
    }

    setStatus({ state: 'saving' });
    try {
      await fetch(`${SERV_ROOT}/auth/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next, confirm_password: confirm }),
      });
      setFormKey((k) => k + 1);
      setStatus({ state: 'success', message: textOr('settings.password.changed', 'Password changed', 'Пароль змінено') });
    } catch (err) {
      const apiCode = err instanceof FetchHttpError && typeof err.body?.code === 'string' ? err.body.code : '';
      setStatus({ state: 'error', message: errorText(apiCode) });
    }
  };

  return (
    <form key={formKey} id="password" className="settings-section" onSubmit={handleSubmit} autoComplete="on">
      <div className="settings-section-header">
        <h2 className="settings-section-title">{textOr('settings.password.title', 'Change password', 'Змінити пароль')}</h2>
        <p className="settings-section-description">
          {textOr('settings.password.description', 'Change the password you use to sign in to your account.', 'Змініть пароль, яким ви входите в обліковий запис.')}
        </p>
      </div>
      <div className="settings-form-grid">
        <div className="settings-field full-width">
          <label className="settings-field-label" htmlFor="settings-current-password">
            {textOr('settings.password.current', 'Current password', 'Поточний пароль')}
          </label>
          <PasswordInput id="settings-current-password" name="current_password" className="settings-field-input" autoComplete="current-password" />
        </div>
        <div className="settings-field">
          <label className="settings-field-label" htmlFor="settings-new-password">
            {textOr('settings.password.new', 'New password', 'Новий пароль')}
          </label>
          <PasswordInput id="settings-new-password" name="new_password" className="settings-field-input" autoComplete="new-password" />
        </div>
        <div className="settings-field">
          <label className="settings-field-label" htmlFor="settings-confirm-password">
            {textOr('settings.password.confirm', 'Repeat new password', 'Повторіть новий пароль')}
          </label>
          <PasswordInput id="settings-confirm-password" name="confirm_password" className="settings-field-input" autoComplete="new-password" />
        </div>
        <div className="settings-field full-width">
          <SettingsFieldNote>
            <p>{textOr('settings.password.hint', 'At least {{min}} characters. You stay signed in on this device.', 'Щонайменше {{min}} символів. Ви залишитеся в обліковому записі на цьому пристрої.', { min: MIN_PASSWORD_LENGTH })}</p>
          </SettingsFieldNote>
        </div>
      </div>
      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Button text={textOr('settings.password.submit', 'Change password', 'Змінити пароль')} type="submit" loading={status?.state === 'saving'} />
        {status?.state === 'success' && <span style={{ color: '#16a34a', fontSize: '0.875rem' }}>✓ {status.message}</span>}
        {status?.state === 'error' && <span style={{ color: '#dc2626', fontSize: '0.875rem' }} role="alert">✗ {status.message}</span>}
      </div>
    </form>
  );
}

export default ChangePasswordSection;
