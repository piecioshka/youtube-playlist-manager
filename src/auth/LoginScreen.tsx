import { useI18n } from '../i18n/LocaleProvider';
import type { AuthMessage } from '../i18n/messages';
import type { AuthStatus } from './useGoogleAuth';

type LoginScreenProps = {
  status: AuthStatus;
  message: AuthMessage | null;
  onSignIn: () => void;
  onRetry: () => void;
};

export function LoginScreen({
  status,
  message,
  onSignIn,
  onRetry,
}: LoginScreenProps) {
  const { t } = useI18n();

  return (
    <section className="login" aria-labelledby="login-heading">
      <h2 id="login-heading" className="login__heading">
        {t.signInHeading}
      </h2>
      <p className="login__lead">{t.signInLead}</p>
      {message && (
        <p
          className={status === 'error' ? 'notice notice--error' : 'notice'}
          role={status === 'error' ? 'alert' : 'status'}
        >
          {t.authMessage[message]}
        </p>
      )}
      {status === 'error' && (
        <button type="button" className="button" onClick={onRetry}>
          {t.retry}
        </button>
      )}
      <button
        type="button"
        className="button button--primary"
        onClick={onSignIn}
        disabled={status !== 'signedOut'}
      >
        {status === 'loading' ? t.loading : t.signInButton}
      </button>
    </section>
  );
}
