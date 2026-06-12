import { useMemo, useState, type FormEvent } from 'react';
import type { Speaker } from '../../../backend/types';
import { groupDuplicateSpeakers } from '../../lib/speakerDuplicates';
import { useI18n } from '../../i18n/I18nProvider';

interface SpeakersViewProps {
  speakers: Speaker[];
  loading: boolean;
  backendMode: boolean;
  searchTerm: string;
  onCreate: (name: string, bio: string) => Promise<void>;
  onUpdate: (id: number, name: string, bio: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onMerge?: (keepId: number, mergeIds: number[]) => Promise<void>;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function SpeakersView({
  speakers,
  loading,
  backendMode,
  searchTerm,
  onCreate,
  onUpdate,
  onDelete,
  onMerge,
}: SpeakersViewProps) {
  const { t } = useI18n();
  const [mergingKey, setMergingKey] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newBio, setNewBio] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const duplicateGroups = useMemo(() => groupDuplicateSpeakers(speakers), [speakers]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return speakers;
    return speakers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.bio ?? '').toLowerCase().includes(q),
    );
  }, [speakers, searchTerm]);

  async function handleMergeGroup(group: { key: string; speakers: Speaker[] }) {
    if (!onMerge || group.speakers.length < 2) return;
    const keep = group.speakers[0];
    const mergeIds = group.speakers.slice(1).map((s) => s.id);
    const confirmed = window.confirm(
      t('admin.speakers.confirmMerge', {
        name: keep.name,
        count: mergeIds.length,
      }),
    );
    if (!confirmed) return;

    setMergingKey(group.key);
    setActionError(null);
    try {
      await onMerge(keep.id, mergeIds);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'errors.speakersSaveError');
    } finally {
      setMergingKey(null);
    }
  }

  function startEdit(speaker: Speaker) {
    setEditingId(speaker.id);
    setEditName(speaker.name);
    setEditBio(speaker.bio ?? '');
    setActionError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditBio('');
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setActionError(null);
    try {
      await onCreate(newName.trim(), newBio.trim());
      setNewName('');
      setNewBio('');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'errors.speakersSaveError');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(speaker: Speaker) {
    const count = speaker.session_count ?? 0;
    const confirmed = window.confirm(
      count > 0
        ? t('admin.speakers.confirmDeleteWithSessions', { name: speaker.name, count })
        : t('admin.speakers.confirmDelete', { name: speaker.name }),
    );
    if (!confirmed) return;

    setDeletingId(speaker.id);
    setActionError(null);
    try {
      await onDelete(speaker.id);
      if (editingId === speaker.id) cancelEdit();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'errors.speakerDeleteError');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveEdit(id: number) {
    if (!editName.trim()) return;
    setSavingId(id);
    setActionError(null);
    try {
      await onUpdate(id, editName.trim(), editBio.trim());
      cancelEdit();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'errors.speakersSaveError');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <div className="loader">{t('common.loading')}</div>;
  }

  return (
    <div className="admin-speakers-panel">
      <p className="admin-users-hint">
        {backendMode ? t('admin.speakers.hint') : t('admin.speakers.hintDemo')}
      </p>

      {actionError && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {actionError.startsWith('errors.') ? t(actionError) : actionError}
        </div>
      )}

      {backendMode && duplicateGroups.length > 0 && onMerge && (
        <div className="admin-speakers-duplicates">
          <h3 className="admin-speakers-duplicates-title">{t('admin.speakers.duplicatesTitle')}</h3>
          <p className="admin-speakers-duplicates-hint">{t('admin.speakers.duplicatesHint')}</p>
          {duplicateGroups.map((group) => (
            <div key={group.key} className="admin-speakers-duplicate-card">
              <div className="admin-speakers-duplicate-names">
                {group.speakers.map((s) => (
                  <span key={s.id} className="admin-speakers-duplicate-chip">
                    {s.name}
                    <span className="admin-speakers-duplicate-count">({s.session_count ?? 0})</span>
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="btn-save admin-speaker-btn"
                disabled={mergingKey === group.key}
                onClick={() => handleMergeGroup(group)}
              >
                {mergingKey === group.key
                  ? t('booking.saving')
                  : t('admin.speakers.mergeInto', { name: group.speakers[0].name })}
              </button>
            </div>
          ))}
        </div>
      )}

      {backendMode && (
        <form className="admin-speakers-add" onSubmit={handleCreate}>
          <div className="admin-speakers-add-fields">
            <input
              className="form-input"
              placeholder={t('admin.speakers.namePlaceholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="form-input"
              placeholder={t('admin.speakers.bioPlaceholder')}
              value={newBio}
              onChange={(e) => setNewBio(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-save" disabled={creating || !newName.trim()}>
            {creating ? t('booking.saving') : t('admin.speakers.add')}
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎤</div>
          <div>{t('admin.speakers.empty')}</div>
        </div>
      ) : (
        <div className="admin-users-table-wrap">
          <table className="admin-users-table admin-speakers-table">
            <thead>
              <tr>
                <th>{t('admin.speakers.name')}</th>
                <th>{t('admin.speakers.sessions')}</th>
                <th>{t('admin.speakers.bio')}</th>
                {backendMode && <th />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((speaker) => {
                const isEditing = editingId === speaker.id;
                return (
                  <tr key={speaker.id}>
                    <td>
                      <div className="admin-speaker-cell">
                        <div className="speaker-avatar">{getInitials(speaker.name)}</div>
                        {isEditing ? (
                          <input
                            className="form-input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        ) : (
                          <span className="admin-user-name">{speaker.name}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="admin-speaker-count">
                        {speaker.session_count ?? 0}
                      </span>
                    </td>
                    <td className="admin-speaker-bio-cell">
                      {isEditing ? (
                        <textarea
                          className="form-textarea admin-speaker-bio-input"
                          rows={2}
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          placeholder={t('admin.speakers.bioPlaceholder')}
                        />
                      ) : (
                        <span className="admin-speaker-bio-preview">
                          {speaker.bio?.trim() || t('admin.speakers.noBio')}
                        </span>
                      )}
                    </td>
                    {backendMode && (
                      <td className="admin-users-actions">
                        {isEditing ? (
                          <div className="admin-speaker-edit-actions">
                            <button
                              type="button"
                              className="btn-save admin-speaker-btn"
                              disabled={savingId === speaker.id || !editName.trim()}
                              onClick={() => handleSaveEdit(speaker.id)}
                            >
                              {savingId === speaker.id ? t('booking.saving') : t('common.save')}
                            </button>
                            <button
                              type="button"
                              className="btn-cancel admin-speaker-btn"
                              onClick={cancelEdit}
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        ) : (
                          <div className="admin-speaker-edit-actions">
                            <button
                              type="button"
                              className="btn-save admin-speaker-btn"
                              onClick={() => startEdit(speaker)}
                            >
                              {t('common.edit')}
                            </button>
                            <button
                              type="button"
                              className="btn-danger admin-speaker-btn"
                              disabled={deletingId === speaker.id}
                              onClick={() => handleDelete(speaker)}
                            >
                              {deletingId === speaker.id ? t('booking.saving') : t('common.delete')}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
