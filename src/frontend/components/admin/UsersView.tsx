/**
 * Felhasználók kezelése — szerepkör, booker termek, törlés.
 * AdminApp users nézet; saját fiók szerepköre és törlése tiltott.
 * Props: users, currentUserId, onRoleChange, onRoomsChange, onDelete.
 */
import { useState } from 'react';
import type { User, UserRole } from '../../../backend/types';
import { ROOMS } from '../../lib/rooms';
import { useI18n } from '../../i18n/I18nProvider';

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
      <div className="empty-state">
        <div className="empty-state-icon">👥</div>
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
    <div className="admin-users-panel">
      <p className="admin-users-hint">{t('admin.users.hint')}</p>
      <div className="admin-users-table-wrap">
        <table className="admin-users-table">
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
                  <td>
                    {isBooker && onRoomsChange ? (
                      <div className="admin-user-rooms">
                        <button
                          type="button"
                          className="admin-rooms-toggle"
                          onClick={() =>
                            setExpandedRoomsId(expandedRoomsId === u.id ? null : u.id)
                          }
                        >
                          {(u.assigned_room_ids?.length ?? 0) > 0
                            ? t('admin.users.roomsCount', {
                                count: u.assigned_room_ids!.length,
                              })
                            : t('admin.users.allRooms')}
                        </button>
                        {expandedRoomsId === u.id && (
                          <div className="admin-user-rooms-list">
                            {ROOMS.map((r) => (
                              <label key={r.id} className="admin-room-check">
                                <input
                                  type="checkbox"
                                  checked={u.assigned_room_ids?.includes(r.id) ?? false}
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
                      <span className="admin-users-na">—</span>
                    )}
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
