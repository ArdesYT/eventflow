import logo from '../../assets/Logo.png';
import conferenceRoom from '../../assets/login-hero.webp';
import { useI18n } from '../i18n/I18nProvider';
import DisplayControls from './DisplayControls';
import styles from './landingPage.module.css';

interface LandingPageProps {
  onBrowseProgram: () => void;
  onSignIn: () => void;
}

type IconName = 'calendar' | 'conflict' | 'bookmark' | 'people' | 'download' | 'globe';

const iconPaths: Record<IconName, string> = {
  calendar: 'M8 3v4m8-4v4M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2 9h2m4 0h2m-8 3h2',
  conflict: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  bookmark: 'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-4-6 4Z',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z',
};

const features: { key: string; icon: IconName }[] = [
  { key: 'Schedule', icon: 'calendar' },
  { key: 'Conflicts', icon: 'conflict' },
  { key: 'Attendee', icon: 'bookmark' },
  { key: 'People', icon: 'people' },
  { key: 'Export', icon: 'download' },
  { key: 'Access', icon: 'globe' },
];

const steps: { key: string; icon: IconName }[] = [
  { key: 'Prepare', icon: 'people' },
  { key: 'Schedule', icon: 'calendar' },
  { key: 'Discover', icon: 'bookmark' },
];

const roleKeys = ['Admin', 'Organizer', 'Attendee', 'Guest'];
const faqKeys = ['Guest', 'Save', 'Booking', 'Changes', 'Devices'];

const previewSessions = [
  { time: '09:00', title: 'previewSessionOne', room: 'previewRoomOne', color: 'blue' },
  { time: '13:00', title: 'previewSessionTwo', room: 'previewRoomTwo', color: 'green' },
  { time: '16:00', title: 'previewSessionThree', room: 'previewRoomThree', color: 'amber' },
];

function LandingIcon({ name }: { name: IconName }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}

export default function LandingPage({ onBrowseProgram, onSignIn }: LandingPageProps) {
  const { t } = useI18n();

  return (
    <div className={styles.page} id="landing-top">
      <a className={styles.skipLink} href="#landing-content">{t('landing.skipToContent')}</a>

      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerContent}`}>
          <a className={styles.brand} href="#landing-top" aria-label="EventFlow">
            <img src={logo} alt="" width="34" height="34" />
            <span>EventFlow</span>
          </a>

          <nav className={styles.navigation} aria-label="EventFlow">
            <a href="#features">{t('landing.navFeatures')}</a>
            <a href="#how-it-works">{t('landing.navHowItWorks')}</a>
            <a href="#questions">{t('landing.navFaq')}</a>
          </nav>

          <div className={styles.headerActions}>
            <DisplayControls />
            <button type="button" className={styles.headerSignIn} onClick={onSignIn}>
              {t('login.signIn')}
            </button>
          </div>
        </div>
      </header>

      <main id="landing-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={`${styles.container} ${styles.heroContent}`}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>{t('landing.eyebrow')}</p>
              <h1 className={styles.title} id="landing-title">
                {t('landing.title')}{' '}
                <span>{t('landing.accent')}</span>
              </h1>
              <p className={styles.intro}>{t('landing.intro')}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryButton} onClick={onBrowseProgram}>
                  {t('landing.browseProgram')}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={onSignIn}>
                  {t('login.signIn')}
                </button>
              </div>
              <p className={styles.heroNote}>{t('landing.heroNote')}</p>
            </div>

            <figure className={styles.preview} aria-labelledby="landing-preview-label">
              <img className={styles.previewPhoto} src={conferenceRoom} alt=""
                width="1200" height="800" fetchPriority="high" />
              <figcaption className={styles.schedule}>
                <div className={styles.scheduleHeader}>
                  <div>
                    <p className={styles.scheduleLabel} id="landing-preview-label">{t('landing.previewLabel')}</p>
                    <h2>{t('landing.previewTitle')}</h2>
                  </div>
                  <span className={styles.scheduleIcon}><LandingIcon name="calendar" /></span>
                </div>
                <p className={styles.scheduleDate}>{t('landing.previewDate')}</p>
                <ul className={styles.scheduleList}>
                  {previewSessions.map(({ time, title, room, color }) => (
                    <li className={styles.scheduleRow} data-color={color} key={time}>
                      <time dateTime={time}>{time}</time>
                      <div>
                        <strong>{t(`landing.${title}`)}</strong>
                        <span>{t(`landing.${room}`)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </figcaption>
            </figure>
          </div>

          <div className={`${styles.container} ${styles.viewStrip}`}>
            <span className={styles.stripLabel}>EventFlow</span>
            <span>{t('public.viewList')}</span>
            <span>{t('public.viewAgenda')}</span>
            <span>{t('public.viewCalendar')}</span>
            <span>{t('public.mySchedule')}</span>
          </div>
        </section>

        <section className={`${styles.container} ${styles.section}`} id="features" aria-labelledby="features-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>{t('landing.benefitsLabel')}</p>
              <h2 id="features-title">{t('landing.benefitsTitle')}</h2>
            </div>
            <p className={styles.sectionIntro}>{t('landing.benefitsIntro')}</p>
          </div>
          <div className={styles.featureGrid}>
            {features.map(({ key, icon }) => (
              <article className={styles.feature} key={key}>
                <span className={styles.featureIcon} data-icon={icon}><LandingIcon name={icon} /></span>
                <h3>{t(`landing.feature${key}Title`)}</h3>
                <p>{t(`landing.feature${key}Description`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.workflow} id="how-it-works" aria-labelledby="workflow-title">
          <div className={`${styles.container} ${styles.section}`}>
            <div className={styles.workflowHeading}>
              <p className={styles.eyebrow}>{t('landing.workflowLabel')}</p>
              <h2 id="workflow-title">{t('landing.workflowTitle')}</h2>
              <p className={styles.sectionIntro}>{t('landing.workflowIntro')}</p>
            </div>
            <ol className={styles.steps}>
              {steps.map(({ key, icon }) => (
                <li className={styles.step} key={key}>
                  <span className={styles.stepIcon}><LandingIcon name={icon} /></span>
                  <h3>{t(`landing.step${key}Title`)}</h3>
                  <p>{t(`landing.step${key}Description`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${styles.container} ${styles.section} ${styles.roles}`} aria-labelledby="roles-title">
          <div className={styles.rolesHeading}>
            <p className={styles.eyebrow}>{t('landing.rolesLabel')}</p>
            <h2 id="roles-title">{t('landing.rolesTitle')}</h2>
          </div>
          <div className={styles.roleGrid}>
            {roleKeys.map((role) => (
              <article className={styles.role} key={role}>
                <h3>{t(`landing.role${role}Title`)}</h3>
                <p>{t(`landing.role${role}Description`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.faqSection} id="questions" aria-labelledby="faq-title">
          <div className={`${styles.container} ${styles.section} ${styles.faqLayout}`}>
            <div className={styles.faqHeading}>
              <p className={styles.eyebrow}>{t('landing.faqLabel')}</p>
              <h2 id="faq-title">{t('landing.faqTitle')}</h2>
            </div>
            <div className={styles.faqList}>
              {faqKeys.map((key) => (
                <details className={styles.faqItem} key={key}>
                  <summary>{t(`landing.faq${key}Question`)}</summary>
                  <p>{t(`landing.faq${key}Answer`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.container} ${styles.closing}`} aria-labelledby="closing-title">
          <div className={styles.closingContent}>
            <div>
              <h2 id="closing-title">{t('landing.ctaTitle')}</h2>
              <p>{t('landing.ctaDescription')}</p>
            </div>
            <button type="button" className={styles.closingButton} onClick={onBrowseProgram}>
              {t('landing.browseProgram')}
            </button>
          </div>
        </section>
      </main>

      <footer className={`${styles.container} ${styles.footer}`}>
        <a className={styles.brand} href="#landing-top">
          <img src={logo} alt="" width="28" height="28" />
          <span>EventFlow</span>
        </a>
        <p>{t('landing.footerTagline')}</p>
      </footer>
    </div>
  );
}
