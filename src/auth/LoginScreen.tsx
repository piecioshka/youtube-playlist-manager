import type { AuthStatus } from './useGoogleAuth';

type LoginScreenProps = {
  status: AuthStatus;
  message: string | null;
  onSignIn: () => void;
  onRetry: () => void;
};

export function LoginScreen({
  status,
  message,
  onSignIn,
  onRetry,
}: LoginScreenProps) {
  return (
    <section className="login" aria-labelledby="login-heading">
      <h2 id="login-heading" className="login__heading">
        Zaloguj się
      </h2>
      <p className="login__lead">
        Połącz konto Google, żeby zobaczyć swoje playlisty na YouTube,
        posortować je, zmienić im nazwy albo je usunąć.
      </p>
      {message && (
        <p
          className={status === 'error' ? 'notice notice--error' : 'notice'}
          role={status === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      )}
      {status === 'error' && (
        <button type="button" className="button" onClick={onRetry}>
          Spróbuj ponownie
        </button>
      )}
      <button
        type="button"
        className="button button--primary"
        onClick={onSignIn}
        disabled={status !== 'signedOut'}
      >
        {status === 'loading' ? 'Wczytywanie...' : 'Zaloguj przez Google'}
      </button>
    </section>
  );
}
