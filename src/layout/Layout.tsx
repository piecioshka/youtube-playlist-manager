import type { ReactNode } from 'react';
import { GitHubLink } from '../GitHubLink';
import { LanguageToggle } from '../i18n/LanguageToggle';
import { useI18n } from '../i18n/LocaleProvider';
import { routeToHash } from '../routing/route';
import { ThemeToggle } from '../theme/ThemeToggle';
import { YouTubeLink } from '../youtube/YouTubeLink';

export const PRIVACY_POLICY_PATH = 'privacy.html';

type LayoutProps = {
  actions?: ReactNode;
  // The app navigates by hash; a separate page has to load the app's index first
  homeHref?: string;
  children: ReactNode;
};

export function Layout({
  actions,
  homeHref = routeToHash({ name: 'list' }),
  children,
}: LayoutProps) {
  const { t } = useI18n();
  const base = import.meta.env.BASE_URL;

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          {/* The logo and name lead home, to the playlist table */}
          <a className="app__home" href={homeHref}>
            <img
              className="app__logo"
              src={`${base}favicon.svg`}
              alt=""
              width={28}
              height={28}
            />
            <span className="app__title-text">{t.appTitle}</span>
          </a>
        </h1>
        {/* Account actions first, then the same trio as every app: language, theme, GitHub */}
        <div className="app__actions">
          {actions}
          <LanguageToggle />
          <ThemeToggle />
          <GitHubLink />
        </div>
      </header>
      <main className="app__main">{children}</main>
      <footer className="app__footer">
        {/* One line on a wide screen; on a narrow one it breaks between items, not inside them */}
        <p className="app__footer-line">
          <span className="app__footer-item">{t.footerNoServer}</span> ·{' '}
          <span className="app__footer-item">
            {t.footerWorksWith}{' '}
            <YouTubeLink
              className="app__footer-link"
              href="https://www.youtube.com"
            >
              YouTube
            </YouTubeLink>
          </span>{' '}
          ·{' '}
          <a
            className="app__footer-link app__footer-item"
            href={`${base}${PRIVACY_POLICY_PATH}`}
          >
            {t.footerPrivacy}
          </a>{' '}
          ·{' '}
          <a
            className="app__footer-link app__footer-item"
            href="https://piecioshka.mit-license.org"
            target="_blank"
            rel="noreferrer"
          >
            {t.footerLicense}
          </a>
        </p>
      </footer>
    </div>
  );
}
