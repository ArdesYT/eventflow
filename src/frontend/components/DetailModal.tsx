import type { Session } from '../../Backend/types';

interface DetailModalProps {
  session: Session;
  onClose: () => void;
  onDelete: (id: number) => void;
}

const ACCENT: Record<string, string> = {
  blue: '#1a56db', amber: '#f59e0b', green: '#057a55', red: '#e02424',
};

export default function DetailModal({ session, onClose, onDelete }: DetailModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: ACCENT[session.color] ?? '#1a56db', flexShrink: 0,
            }} />
            <h2 className="modal-title">{session.title}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div>
          <div className="detail-row">
            <span className="detail-label">Date</span>
            <span className="detail-value">{session.date}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Time</span>
            <span className="detail-value">{session.start_time} – {session.end_time}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Room</span>
            <span className="detail-value">{session.room_name}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Speaker</span>
            <span className="detail-value">{session.speaker_name}</span>
          </div>
          {session.description && (
            <div className="detail-row">
              <span className="detail-label">Notes</span>
              <span className="detail-value" style={{ fontWeight: 400 }}>{session.description}</span>
            </div>
          )}
        </div>
        <div className="btn-row">
          <button className="btn-danger" onClick={() => { onDelete(session.id); onClose(); }}>
            Delete
          </button>
          <button className="btn-save" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
