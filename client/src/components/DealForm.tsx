import { useState } from 'react';
import type { DealInput } from '../api';
import { STAGES, STAGE_LABELS, type Contact, type Deal, type Organization } from '../types';

const STAGE_PROBABILITY: Record<string, number> = {
  new: 10, qualified: 25, proposal: 50, negotiation: 75, won: 100, lost: 0,
};

export default function DealForm({
  initial,
  organizations,
  contacts,
  onSubmit,
  onCancel,
  saving,
  error,
}: {
  initial?: Deal;
  organizations: Organization[];
  contacts: Contact[];
  onSubmit: (d: DealInput) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [organizationId, setOrganizationId] = useState(initial?.organization_id ? String(initial.organization_id) : '');
  const [contactId, setContactId] = useState(initial?.contact_id ? String(initial.contact_id) : '');
  const [stage, setStage] = useState<Deal['stage']>(initial?.stage ?? 'new');
  const [value, setValue] = useState(initial ? String(initial.value) : '');
  const [probability, setProbability] = useState(initial ? String(initial.probability) : String(STAGE_PROBABILITY.new));
  const [closeDate, setCloseDate] = useState(initial?.close_date ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          organization_id: organizationId ? Number(organizationId) : null,
          contact_id: contactId ? Number(contactId) : null,
          stage,
          value: value === '' ? 0 : Number(value),
          probability: Number(probability),
          close_date: closeDate,
        });
      }}
    >
      <div className="form-group">
        <label htmlFor="deal-name">Deal name *</label>
        <input id="deal-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="deal-org">Organization</label>
          <select id="deal-org" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
            <option value="">— None —</option>
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="deal-contact">Primary contact</label>
          <select id="deal-contact" value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">— None —</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="deal-stage">Stage</label>
          <select
            id="deal-stage"
            value={stage}
            onChange={(e) => {
              const s = e.target.value as Deal['stage'];
              setStage(s);
              setProbability(String(STAGE_PROBABILITY[s]));
            }}
          >
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="deal-value">Value (USD)</label>
          <input id="deal-value" type="number" min="0" step="100" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="deal-prob">Probability of close (%)</label>
          <input id="deal-prob" type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="deal-close">Close date</label>
          <input id="deal-close" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add deal'}
        </button>
      </div>
    </form>
  );
}
