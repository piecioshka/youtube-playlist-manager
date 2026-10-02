import type { ReactNode } from 'react';

type YouTubeLinkProps = {
  href: string;
  className?: string;
  title?: string;
  children: ReactNode;
};

// Piktogram „otwiera się poza aplikacją”; ozdobny, bo cel linku mówi już jego tekst
export function ExternalIcon() {
  return (
    <svg
      className="external-link__icon"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <path
        d="M5 2.5H2.5v7h7V7M7.5 2h2.5v2.5M10 2 5.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Link, który wychodzi z aplikacji na YouTube: nowa karta, kropkowane podkreślenie i piktogram na końcu
export function YouTubeLink({
  href,
  className,
  title,
  children,
}: YouTubeLinkProps) {
  return (
    <a
      className={
        className === undefined ? 'external-link' : `external-link ${className}`
      }
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
    >
      <span className="external-link__text">{children}</span>
      <ExternalIcon />
    </a>
  );
}
