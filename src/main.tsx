import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './errors/ErrorBoundary';
import { LocaleProvider } from './i18n/LocaleProvider';
import './styles/app.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <LocaleProvider>
      <ErrorBoundary onReload={() => window.location.reload()}>
        <App />
      </ErrorBoundary>
    </LocaleProvider>
  </StrictMode>,
);
