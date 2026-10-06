import { useI18n } from '../i18n/I18nProvider';
import styles from './StatCards.module.css';

interface StatCard {
  labelKey: string;
  value: number;
  subKey: string;
}

export default function StatCards({ cards }: { cards: StatCard[] }) {
  const { t } = useI18n();
  return (
    <div className={styles['stats-grid']}>
      {cards.map(({ labelKey, value, subKey }) => (
        <div key={labelKey} className={styles['stat-card']}>
          <div className={styles['stat-label']}>{t(labelKey)}</div>
          <div className={styles['stat-value']}>{value}</div>
          <div className={styles['stat-sub']}>{t(subKey)}</div>
        </div>
      ))}
    </div>
  );
}
