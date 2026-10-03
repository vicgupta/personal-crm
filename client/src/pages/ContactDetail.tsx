import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, type ActivityInput } from '../api';
import type { Activity, ContactDetail as ContactDetailType } from '../types';
import Modal from '../components/Modal';
import ActivityForm from '../components/ActivityForm';
import ActivityTimeline from '../components/ActivityTimeline';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ContactDetail() {
  const { id } = useParams();
  const contactId = Number(id);
  const [contact, setContact] = useState<ContactDetailType | null>(null);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      setContact(await api.contacts.get(contactId));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [contactId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (data: ActivityInput) => {
    setSaving(true);
    setFormError('');
    try {
      await api.activities.create({ ...data, contact_id: contactId });
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
  if (!contact) return <div className="loading">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{contact.name}</h1>
          <p>{contact.title}{contact.organization ? ` · ${contact.organization.name}` : ''}</p>
        </div>
        <span className={`badge badge-${contact.status}`}>{contact.status}</span>
      </div>
      <div className="card">
        <h2>Details</h2>
        <dl className="kv">
          <dt>Email</dt><dd>{contact.email || '—'}</dd>
          <dt>Phone</dt><dd>{contact.phone || '—'}</dd>
          <dt>Organization</dt>
          <dd>{contact.organization ? <Link to={`/organizations/${contact.organization.id}`}>{contact.organization.name}</Link> : '—'}</dd>
        </dl>
      </div>
      <div className="card">
        <div className="section-title">
          <h2>Activity timeline ({contact.activities.length})</h2>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus />Log activity</button>
        </div>
        <ActivityTimeline activities={contact.activities} onToggleDone={toggleDone} onDelete={setDeleting} />
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
