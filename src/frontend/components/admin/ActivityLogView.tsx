import type { ActivityLogEntry } from '../../../backend/types';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDateKey, formatTimeKey } from '../../i18n/dateFormat';

interface ActivityLogViewProps {
  entries: ActivityLogEntry[];
  loading: boolean;
}

export default function ActivityLogView({ entries, loading }: ActivityLogViewProps) {
  const { t, locale } = useI18n();

  if (loading) {
    return <div className="loader">{t('common.loading')}</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div>{t('admin.audit.empty')}</div>
      </div>
    );
  }

  return (
    <div className="admin-audit-panel">
      <p className="admin-users-hint">{t('admin.audit.hint')}</p>
      <div className="admin-audit-table-wrap">
        <table className="admin-users-table admin-audit-table">
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
              const created = e.created_at.replace(' ', 'T');
              const datePart = created.slice(0, 10);
              const timePart = created.slice(11, 16);
              return (
                <tr key={e.id}>
                  <td className="admin-audit-time">
                    {formatDateKey(datePart, locale)}{' '}
                    {formatTimeKey(timePart)}
                  </td>
                  <td>{e.user_name ?? '—'}</td>
                  <td>
                    <span className="admin-audit-action-badge">
                      {t(`admin.audit.actions.${e.action.replace(/\./g, '_')}`)}
                    </span>
                  </td>
                  <td className="admin-audit-details">{e.details ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
