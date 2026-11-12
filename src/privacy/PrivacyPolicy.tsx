import { useI18n } from '../i18n/LocaleProvider';
import { YouTubeLink } from '../youtube/YouTubeLink';

export function PrivacyPolicy() {
  const { t } = useI18n();
  const policy = t.privacyPolicy;

  return (
    <article className="privacy" aria-labelledby="privacy-heading">
      <h2 id="privacy-heading" className="privacy__heading">
        {policy.heading}
      </h2>
      <p className="privacy__updated">{policy.updated}</p>
      <p className="privacy__intro">{policy.intro}</p>
      {policy.sections.map((section) => (
        <section key={section.heading} className="privacy__section">
          <h3 className="privacy__section-heading">{section.heading}</h3>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="privacy__paragraph">
              {paragraph}
            </p>
          ))}
          {section.links.length > 0 && (
            <ul className="privacy__links">
              {section.links.map((link) => (
                <li key={link.href}>
                  <YouTubeLink href={link.href}>{link.label}</YouTubeLink>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}
