import React from 'react';
import '../styles/PasswordRecoveryForm.css';
import { t } from '../packages/i18n';

interface PasswordRecoveryFormProps {
  onSubmit: (email: string) => void;
}

export const PasswordRecoveryForm: React.FC<PasswordRecoveryFormProps> = ({ onSubmit }) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    onSubmit(email);
  };

  return (
    <div className="password-recovery-container">
      <div className="card password-recovery-card">
        <h2 className="title password-recovery-title">{t('auth.resetPassword')}</h2>
        
        <p className="password-recovery-description">
          {t('auth.resetPasswordDesc')}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">{t('auth.email')}</label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              placeholder={t('auth.emailPlaceholder')}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary password-recovery-submit-btn">
            {t('auth.sendResetLink')}
          </button>
        </form>

        <div className="password-recovery-footer">
          {t('auth.rememberPassword')}{' '}
          <a href="/signin" className="form-link">{t('auth.signIn')}</a>
        </div>
      </div>
    </div>
  );
};

