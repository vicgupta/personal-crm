import { useState } from 'react';
import type { ActivityInput } from '../api';
import { ACTIVITY_TYPES, type Activity } from '../types';

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ActivityForm({
  onSubmit,
  onCancel,
  saving,
  error,
}: {
  onSubmit: (d: ActivityInput) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [type, setType] = useState<Activity['type']>('note');
  const [description, setDescription] = useState('');
  const [happenedAt, setHappenedAt] = useState(nowLocal());
  const [dueDate, setDueDate] = useState('');
  const [done, setDone] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          type,
          description,
          happened_at: happenedAt.replace('T', ' '),
          due_date: dueDate,
          done,
        });
      }}
    >
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="act-type">Type</label>
          <select id="act-type" value={type} onChange={(e) => setType(e.target.value as Activity['type'])}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="act-when">When</label>
          <input id="act-when" type="datetime-local" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="act-desc">Description *</label>
        <textarea id="act-desc" value={description} onChange={(e) => setDescription(e.target.value)} required autoFocus placeholder="What happened, or what was discussed…" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="act-due">Follow-up due date (optional)</label>
          <input id="act-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
            <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} style={{ width: 'auto' }} />
            Mark as done
          </label>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Log activity'}
        </button>
      </div>
    </form>
  );
}
