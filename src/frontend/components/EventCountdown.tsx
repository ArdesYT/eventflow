import { useEffect, useState } from 'react';
import type { EventProfile } from '../../backend/types';
import { useI18n } from '../i18n/I18nProvider';

function eventStartAt(event: EventProfile): Date | null {
  if (!event.start_date) return null;
  const d = new Date(`${event.start_date}T09:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function eventEndAt(event: EventProfile): Date | null {
  const end = event.end_date ?? event.start_date;
  if (!end) return null;
  const d = new Date(`${end}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface EventCountdownProps {
  event?: EventProfile | null;
}

export default function EventCountdown({ event }: EventCountdownProps) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!event?.start_date) return null;

  const start = eventStartAt(event);
  const end = eventEndAt(event);
  if (!start) return null;

  const nowMs = now.getTime();

  if (end && nowMs > end.getTime()) {
    return (
      <div className="public-hero-countdown public-hero-countdown--ended">
        {t('public.countdownEnded')}
      </div>
    );
  }

  if (nowMs >= start.getTime()) {
    return (
      <div className="public-hero-countdown public-hero-countdown--live">
        <span className="public-countdown-live-dot" aria-hidden="true" />
        {t('public.countdownLive')}
      </div>
    );
  }

  const diff = start.getTime() - nowMs;
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
