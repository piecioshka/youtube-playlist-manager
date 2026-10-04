import { Component, type ReactNode } from 'react';
import { useI18n } from '../i18n/LocaleProvider';

type ErrorBoundaryProps = {
  children: ReactNode;
  onReload: () => void;
};

type ErrorBoundaryState = {
  failed: boolean;
};

function RenderError({ onReload }: { onReload: () => void }) {
  const { t } = useI18n();

  return (
    <main className="app__main">
      <div className="notice notice--error" role="alert">
        <p>{t.renderError}</p>
        <button type="button" className="button" onClick={onReload}>
          {t.reloadPage}
        </button>
      </div>
    </main>
  );
}

// Wyjątek w renderze odmontowuje całe drzewo Reacta; bez granicy zostaje pusta strona
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <RenderError onReload={this.props.onReload} />;
    }
    return this.props.children;
  }
}
