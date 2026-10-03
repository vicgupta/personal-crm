import { useState } from 'react';
import type { OrgInput } from '../api';
import type { Organization } from '../types';

export default function OrgForm({
  initial,
  onSubmit,
  onCancel,
  saving,
  error,
}: {
  initial?: Organization;
  onSubmit: (d: OrgInput) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [website, setWebsite] = useState(initial?.website ?? '');
  const [industry, setIndustry] = useState(initial?.industry ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, website, industry, notes });
      }}
    >
      <div className="form-group">
        <label htmlFor="org-name">Name *</label>
        <input id="org-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="org-website">Website</label>
          <input id="org-website" type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" />
        </div>
        <div className="form-group">
          <label htmlFor="org-industry">Industry</label>
          <input id="org-industry" type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="org-notes">Notes</label>
        <textarea id="org-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add organization'}
        </button>
      </div>
    </form>
  );
}
