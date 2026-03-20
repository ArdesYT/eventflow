import { useState, useEffect } from 'react';
import type { BookingFormData, EventColor } from '../../Backend/types';

interface BookingModalProps {
  saving?: boolean;
  saveError?: string | null;
  initialDate?: string;
  onSave: (data: BookingFormData) => void;
  onClose: () => void;
}

// Mirror your rooms / speakers tables here, or fetch them from
// GET /api/rooms and GET /api/speakers at mount time.
const ROOMS = [
  { id: 1, name: 'Main Hall'     },
  { id: 2, name: 'Room A'        },
  { id: 3, name: 'Room B'        },
  { id: 4, name: 'Workshop'      },
  { id: 5, name: 'Outdoor Stage' },
];

const SPEAKERS = [
  { id: 1, name: 'Dr. Anna Kovács' },
  { id: 2, name: 'Péter Nagy'      },
  { id: 3, name: 'Eszter Molnár'   },
  { id: 4, name: 'Balázs Kiss'     },
  { id: 5, name: 'Multiple'        },
];

const COLORS: EventColor[] = ['blue', 'amber', 'green', 'red'];

function todayStr(): string {
  const t = new Date(2026, 2, 20);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

export default function BookingModal({ initialDate, onSave, onClose, saving = false, saveError = null }: BookingModalProps) {
  const [form, setForm] = useState<BookingFormData>({
    title:        '',
    description:  '',
    date:         initialDate ?? todayStr(),
    start_time:   '09:00',
    end_time:     '10:00',
    room_id:      ROOMS[0].id,
    speaker_id:   SPEAKERS[0].id,
    room_name:    ROOMS[0].name,
    speaker_name: SPEAKERS[0].name,
    color:        'blue',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof BookingFormData, string>>>({});

  useEffect(() => {
    if (initialDate) setForm(f => ({ ...f, date: initialDate }));
  }, [initialDate]);

  function set<K extends keyof BookingFormData>(key: K, value: BookingFormData[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function handleRoomChange(id: number) {
    const room = ROOMS.find(r => r.id === id)!;
    setForm(f => ({ ...f, room_id: room.id, room_name: room.name }));
  }

  function handleSpeakerChange(id: number) {
    const sp = SPEAKERS.find(s => s.id === id)!;
    setForm(f => ({ ...f, speaker_id: sp.id, speaker_name: sp.name }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.title.trim()) errs.title = 'Required';
    if (!form.date)         errs.date  = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (validate()) onSave(form);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New Booking</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-group">
          <label className="form-label">Session Title</label>
          <input
            className={`form-input${errors.title ? ' error' : ''}`}
            placeholder="e.g. Keynote: Future of AI"
            value={form.title}
            onChange={e => set('title', e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              className={`form-input${errors.date ? ' error' : ''}`}
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Room</label>
            <select
              className="form-select"
              value={form.room_id}
              onChange={e => handleRoomChange(Number(e.target.value))}
            >
              {ROOMS.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Start Time</label>
            <input
              className="form-input"
              type="time"
              value={form.start_time}
              onChange={e => set('start_time', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">End Time</label>
            <input
              className="form-input"
              type="time"
              value={form.end_time}
              onChange={e => set('end_time', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Speaker</label>
          <select
            className="form-select"
            value={form.speaker_id}
            onChange={e => handleSpeakerChange(Number(e.target.value))}
          >
            {SPEAKERS.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Category Color</label>
          <div className="color-picker">
            {COLORS.map(c => (
              <div
                key={c}
                className={`color-dot color-${c}${form.color === c ? ' active' : ''}`}
                onClick={() => set('color', c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-textarea"
            placeholder="Optional notes..."
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>

        {saveError && <div className="login-error" style={{marginBottom:"12px"}}>{saveError}</div>}
        <div className="btn-row">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
