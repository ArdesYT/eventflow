/**
 * Audit napló táblázat — admin audit nézet.
 * Props: entries (ActivityLogEntry[]), loading.
 */
import type { ActivityLogEntry } from '../../../backend/types';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDateKey, formatTimeKey } from '../../i18n/dateFormat';
import styles from './ActivityLogView.module.css';

interface ActivityLogViewProps {
  entries: ActivityLogEntry[];
  loading: boolean;
}

export default function ActivityLogView({ entries, loading }: ActivityLogViewProps) {
  const { t, locale } = useI18n();

  if (loading) {
    return <div className={styles.loader}>{t('common.loading')}</div>;
  }

  if (entries.length === 0) {
    return (
      <div className={styles['empty-state']}>
        <div className={styles['empty-state-icon']}>📋</div>
        <div>{t('admin.audit.empty')}</div>
      </div>
    );
  }

  return (
    <div className={styles['admin-audit-panel']}>
      <p className={styles['admin-users-hint']}>{t('admin.audit.hint')}</p>
      <div className={styles['admin-audit-table-wrap']}>
        <table className={`${styles['admin-users-table']} ${styles['admin-audit-table']}`}>
          <thead>
            <tr>
              <th>{t('admin.audit.time')}</th>
              <th>{t('admin.audit.user')}</th>
              <th>{t('admin.audit.action')}</th>
              <th>{t('admin.audit.details')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const datePart = e.created_at.slice(0, 10);
              const timePart = e.created_at.slice(11, 16);
              return (
                <tr key={e.id}>
                  <td className={styles['admin-audit-time']}>
                    {formatDateKey(datePart, locale)}{' '}
                    {formatTimeKey(timePart)}
                  </td>
                  <td>{e.user_name ?? '—'}</td>
                  <td>
                    <span className={styles['admin-audit-action-badge']}>
                      {t(`admin.audit.actions.${e.action.replace(/\./g, '_')}`)}
                    </span>
                  </td>
                  <td className={styles['admin-audit-details']}>{e.details ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
