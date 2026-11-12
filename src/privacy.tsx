// Must come first: configures Zod before any module defines a schema
import './zodConfig';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LocaleProvider } from './i18n/LocaleProvider';
import { Layout } from './layout/Layout';
import { PrivacyPolicy } from './privacy/PrivacyPolicy';
import './styles/app.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root element');
}

// A page of its own, not a hash route: Google needs a plain URL it can open without signing in
createRoot(rootElement).render(
  <StrictMode>
    <LocaleProvider>
      <Layout homeHref={import.meta.env.BASE_URL}>
        <PrivacyPolicy />
      </Layout>
    </LocaleProvider>
  </StrictMode>,
);
