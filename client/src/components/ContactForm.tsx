import { useState } from 'react';
import type { ContactInput } from '../api';
import { CONTACT_STATUSES, type Contact, type Organization } from '../types';

export default function ContactForm({
  initial,
  organizations,
  onSubmit,
  onCancel,
  saving,
  error,
}: {
  initial?: Contact;
  organizations: Organization[];
  onSubmit: (d: ContactInput) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [organizationId, setOrganizationId] = useState<string>(
    initial?.organization_id ? String(initial.organization_id) : '',
  );
  const [status, setStatus] = useState<Contact['status']>(initial?.status ?? 'lead');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          email,
          phone,
          title,
          organization_id: organizationId ? Number(organizationId) : null,
          status,
        });
      }}
    >
      <div className="form-group">
        <label htmlFor="contact-name">Name *</label>
        <input id="contact-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="contact-email">Email</label>
          <input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="contact-phone">Phone</label>
          <input id="contact-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="contact-title">Job title</label>
          <input id="contact-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="contact-status">Status</label>
          <select id="contact-status" value={status} onChange={(e) => setStatus(e.target.value as Contact['status'])}>
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="contact-org">Organization</label>
        <select id="contact-org" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
          <option value="">— None —</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add contact'}
        </button>
      </div>
    </form>
  );
}
