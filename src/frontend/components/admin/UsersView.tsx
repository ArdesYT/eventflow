/**
 * Felhasználók kezelése — szerepkör, booker termek, törlés.
 * AdminApp users nézet; saját fiók szerepköre és törlése tiltott.
 * Props: users, currentUserId, onRoleChange, onRoomsChange, onDelete.
 */
import { useState } from 'react';
import type { User, UserRole } from '../../../backend/types';
import { ROOMS } from '../../lib/rooms';
import { useI18n } from '../../i18n/I18nProvider';
import styles from './UsersView.module.css';

interface UsersViewProps {
  users: User[];
  currentUserId: number;
  onRoleChange: (userId: number, role: UserRole) => Promise<void>;
  onRoomsChange?: (userId: number, roomIds: number[]) => Promise<void>;
  onDelete: (userId: number) => Promise<void>;
}

const ROLES: UserRole[] = ['admin', 'booker', 'attendee'];

export default function UsersView({
  users,
  currentUserId,
  onRoleChange,
  onRoomsChange,
  onDelete,
}: UsersViewProps) {
  const { t } = useI18n();
  const [savingRoomsId, setSavingRoomsId] = useState<number | null>(null);
  const [expandedRoomsId, setExpandedRoomsId] = useState<number | null>(null);

  if (users.length === 0) {
    return (
      <div className={styles['empty-state']}>
        <div className={styles['empty-state-icon']}>👥</div>
        <div>{t('admin.users.empty')}</div>
      </div>
    );
  }

  // Booker hozzárendelt termek váltása — checkbox toggle
  async function toggleRoom(user: User, roomId: number) {
    if (!onRoomsChange) return;
    const current = user.assigned_room_ids ?? [];
    const next = current.includes(roomId)
      ? current.filter((id) => id !== roomId)
      : [...current, roomId].sort((a, b) => a - b);
    setSavingRoomsId(user.id);
    try {
      await onRoomsChange(user.id, next);
    } finally {
      setSavingRoomsId(null);
    }
  }

  return (
    <div className={styles['admin-users-panel']}>
      <p className={styles['admin-users-hint']}>{t('admin.users.hint')}</p>
      <div className={styles['admin-users-table-wrap']}>
        <table className={styles['admin-users-table']}>
          <thead>
            <tr>
              <th>{t('admin.users.name')}</th>
              <th>{t('admin.users.email')}</th>
              <th>{t('admin.users.role')}</th>
              <th>{t('admin.users.rooms')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              const isBooker = u.role === 'booker';
              const roomIds = u.assigned_room_ids ?? [];
              return (
                <tr key={u.id}>
                  <td>
                    <div className={styles['admin-user-name']}>{u.name}</div>
                    {isSelf && (
                      <span className={styles['admin-you-badge']}>{t('admin.users.you')}</span>
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className={`${styles['form-select']} ${styles['admin-role-select']}`}
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
                  <td>
                    {isBooker && onRoomsChange ? (
                      <div className={styles['admin-user-rooms']}>
                        <button
                          type="button"
                          className={styles['admin-rooms-toggle']}
                          onClick={() =>
                            setExpandedRoomsId(expandedRoomsId === u.id ? null : u.id)
                          }
                        >
                          {roomIds.length > 0
                            ? t('admin.users.roomsCount', { count: roomIds.length })
                            : t('admin.users.allRooms')}
                        </button>
                        {expandedRoomsId === u.id && (
                          <div className={styles['admin-user-rooms-list']}>
                            {ROOMS.map((r) => (
                              <label key={r.id} className={styles['admin-room-check']}>
                                <input
                                  type="checkbox"
                                  checked={roomIds.includes(r.id)}
                                  disabled={savingRoomsId === u.id}
                                  onChange={() => toggleRoom(u, r.id)}
                                />
                                {t(`rooms.${r.key}`)}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className={styles['admin-users-na']}>—</span>
                    )}
                  </td>
                  <td className={styles['admin-users-actions']}>
                    <button
                      type="button"
                      className={`${styles['btn-danger']} ${styles['admin-delete-btn']}`}
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
