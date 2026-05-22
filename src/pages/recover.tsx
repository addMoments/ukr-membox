import { useState } from 'react';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import { PasswordRecoveryForm } from '../partials/PasswordRecoveryForm';
import { requestPasswordReset } from '../client/auth';

function Recover() {
  const [sent, setSent] = useState(false);

  const handlePasswordRecovery = async (email: string) => {
    await requestPasswordReset(email);
    setSent(true);
  };

  return (
    <div className="App">
      <V2Header />
      <main className="main-content">
        {sent ? (
          <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', fontFamily: 'Poppins, sans-serif', padding: '0 24px' }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Check your email</h2>
            <p style={{ color: '#555', lineHeight: 1.6 }}>
              If an account exists for that email address, we've sent a password reset link. It expires in 15 minutes.
            </p>
          </div>
        ) : (
          <PasswordRecoveryForm onSubmit={handlePasswordRecovery} />
        )}
      </main>
      <V2Footer />
    </div>
  );
}

export default Recover;
