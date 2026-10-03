import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, type ActivityInput } from '../api';
import { STAGE_LABELS, formatDate, formatMoney, type Activity, type DealDetail as DealDetailType } from '../types';
import Modal from '../components/Modal';
import ActivityForm from '../components/ActivityForm';
import ActivityTimeline from '../components/ActivityTimeline';
import ConfirmDialog from '../components/ConfirmDialog';

export default function DealDetail() {
  const { id } = useParams();
  const dealId = Number(id);
  const [deal, setDeal] = useState<DealDetailType | null>(null);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      setDeal(await api.deals.get(dealId));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (data: ActivityInput) => {
    setSaving(true);
    setFormError('');
    try {
      await api.activities.create({ ...data, deal_id: dealId });
      setShowAdd(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (a: Activity) => {
    await api.activities.update(a.id, { done: !a.done });
    await load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await api.activities.remove(deleting.id);
    setDeleting(null);
    await load();
  };

  if (error) return <div className="error-box">{error}</div>;
  if (!deal) return <div className="loading">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>{deal.name}</h1><p>{formatMoney(deal.value)} · closes {formatDate(deal.close_date)}</p></div>
        <span className={`badge badge-${deal.stage}`}>{STAGE_LABELS[deal.stage]}</span>
      </div>
      <div className="card">
        <h2>Details</h2>
        <dl className="kv">
          <dt>Organization</dt>
          <dd>{deal.organization ? <Link to={`/organizations/${deal.organization.id}`}>{deal.organization.name}</Link> : '—'}</dd>
          <dt>Contact</dt>
          <dd>{deal.contact ? <Link to={`/contacts/${deal.contact.id}`}>{deal.contact.name}</Link> : '—'}</dd>
          <dt>Probability</dt><dd>{deal.probability}%</dd>
          <dt>Expected value</dt><dd>{formatMoney(Math.round(deal.value * deal.probability / 100))}</dd>
        </dl>
      </div>
      <div className="card">
        <div className="section-title">
          <h2>Activity timeline ({deal.activities.length})</h2>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus />Log activity</button>
        </div>
        <ActivityTimeline activities={deal.activities} onToggleDone={toggleDone} onDelete={setDeleting} />
      </div>

      {showAdd && (
        <Modal title="Log activity" onClose={() => setShowAdd(false)}>
          <ActivityForm onSubmit={submit} onCancel={() => setShowAdd(false)} saving={saving} error={formError} />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete activity"
          message="Delete this activity?"
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
