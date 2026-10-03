import { Check, Mail, Phone, StickyNote, Trash2 } from 'lucide-react';
import { formatDate, type Activity } from '../types';

const TYPE_ICONS = { note: StickyNote, call: Phone, email: Mail } as const;

export default function ActivityTimeline({
  activities,
  onToggleDone,
  onDelete,
}: {
  activities: Activity[];
  onToggleDone: (a: Activity) => void;
  onDelete: (a: Activity) => void;
}) {
  if (activities.length === 0) return <div className="empty">No activity yet.</div>;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="timeline">
      {activities.map((a) => {
        const Icon = TYPE_ICONS[a.type];
        const isTask = a.due_date !== '';
        const overdue = isTask && !a.done && a.due_date < today;
        return (
          <div key={a.id} className="timeline-item">
            <div className="timeline-icon"><Icon /></div>
            <div className="timeline-body">
              <div className="timeline-head">
                <span className={`badge badge-${a.type}`}>{a.type}</span>
                {isTask && (
                  <span className={`badge ${overdue ? 'badge-overdue' : a.done ? 'badge-won' : 'badge-due'}`}>
                    {a.done ? 'done' : overdue ? `overdue · due ${formatDate(a.due_date)}` : `due ${formatDate(a.due_date)}`}
                  </span>
                )}
                <span className="timeline-date">{formatDate(a.happened_at)}</span>
              </div>
              <div className="timeline-text">{a.description}</div>
            </div>
            {isTask && (
              <button
                className={`task-check${a.done ? ' done' : ''}`}
                title={a.done ? 'Mark not done' : 'Mark done'}
                aria-label={a.done ? `Mark "${a.description.slice(0, 30)}" not done` : `Mark "${a.description.slice(0, 30)}" done`}
                onClick={() => onToggleDone(a)}
              >
                {a.done && <Check />}
              </button>
            )}
            <button className="icon-btn danger" title="Delete activity" onClick={() => onDelete(a)}>
              <Trash2 />
            </button>
          </div>
        );
      })}
    </div>
  );
}
