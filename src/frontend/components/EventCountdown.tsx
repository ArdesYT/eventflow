/**
 * Esemény visszaszámláló — PublicEventsPage hero szekció.
 * Másodpercenként frissül; állapotok: visszaszámlálás, élő, lezárult.
 * Props: event (EventProfile — start_date/end_date alapján számol).
 */
import { useEffect, useState } from 'react';
import type { EventProfile } from '../../backend/types';
import { useI18n } from '../i18n/I18nProvider';

function eventTime(dateKey: string | null, time: string): number | null {
  if (!dateKey) return null;
  const timestamp = new Date(`${dateKey}T${time}`).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

interface EventCountdownProps {
  event?: EventProfile | null;
}

export default function EventCountdown({ event }: EventCountdownProps) {
  const { t } = useI18n();
  // Óra frissítése másodpercenként a visszaszámlálóhoz
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!event?.start_date) return null;

  const start = eventTime(event.start_date, '09:00:00');
  const end = eventTime(event.end_date ?? event.start_date, '23:59:59');
  if (start === null) return null;

  if (end !== null && now > end) {
    return (
      <div className="public-hero-countdown public-hero-countdown--ended">
        {t('public.countdownEnded')}
      </div>
    );
  }

  if (now >= start) {
    return (
      <div className="public-hero-countdown public-hero-countdown--live">
        <span className="public-countdown-live-dot" aria-hidden="true" />
        {t('public.countdownLive')}
      </div>
    );
  }

  const diff = start - now;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const units = [
    { value: days, label: t('public.countdownDays') },
    { value: hours, label: t('public.countdownHours') },
    { value: minutes, label: t('public.countdownMinutes') },
    { value: seconds, label: t('public.countdownSeconds') },
  ];

  return (
    <div className="public-hero-countdown" aria-live="polite">
      <div className="public-countdown-label">{t('public.countdownLabel')}</div>
      <div className="public-countdown-grid">
        {units.map(({ value, label }) => (
          <div key={label} className="public-countdown-unit">
            <span className="public-countdown-num">{String(value).padStart(2, '0')}</span>
            <span className="public-countdown-unit-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
