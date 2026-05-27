import type { User, UserRole } from '../../../backend/types';
import { useI18n } from '../../i18n/I18nProvider';

interface UsersViewProps {
  users: User[];
  currentUserId: number;
  onRoleChange: (userId: number, role: UserRole) => Promise<void>;
  onDelete: (userId: number) => Promise<void>;
}

const ROLES: UserRole[] = ['admin', 'booker', 'attendee'];

export default function UsersView({
  users,
  currentUserId,
  onRoleChange,
  onDelete,
}: UsersViewProps) {
  const { t } = useI18n();

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">👥</div>
        <div>{t('admin.users.empty')}</div>
      </div>
    );
  }

  return (
    <div className="admin-users-panel">
      <p className="admin-users-hint">{t('admin.users.hint')}</p>
      <div className="admin-users-table-wrap">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>{t('admin.users.name')}</th>
              <th>{t('admin.users.email')}</th>
              <th>{t('admin.users.role')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="admin-user-name">{u.name}</div>
                    {isSelf && (
                      <span className="admin-you-badge">{t('admin.users.you')}</span>
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="form-select admin-role-select"
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) =>
                        onRoleChange(u.id, e.target.value as UserRole)
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`login.${r}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="admin-users-actions">
                    <button
                      type="button"
                      className="btn-danger admin-delete-btn"
                      disabled={isSelf}
                      onClick={() => onDelete(u.id)}
                    >
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
