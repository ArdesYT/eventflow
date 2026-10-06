import { useI18n } from '../i18n/I18nProvider';

interface StatCard {
  labelKey: string;
  value: number;
  subKey: string;
}

export default function StatCards({ cards }: { cards: StatCard[] }) {
  const { t } = useI18n();
  return (
    <div className="stats-grid">
      {cards.map(({ labelKey, value, subKey }) => (
        <div key={labelKey} className="stat-card">
          <div className="stat-label">{t(labelKey)}</div>
          <div className="stat-value">{value}</div>
          <div className="stat-sub">{t(subKey)}</div>
        </div>
      ))}
    </div>
  );
}
