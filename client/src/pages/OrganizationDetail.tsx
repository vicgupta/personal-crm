import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { OrganizationDetail } from '../types';

export default function OrganizationDetail() {
  const { id } = useParams();
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.organizations.get(Number(id)).then(setOrg).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="error-box">{error}</div>;
  if (!org) return <div className="loading">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>{org.name}</h1><p>{org.industry}{org.website ? ` · ${org.website}` : ''}</p></div>
      </div>
      {org.notes && <div className="card"><h2>Notes</h2><p>{org.notes}</p></div>}
      <div className="card">
        <h2>Contacts ({org.contacts.length})</h2>
        {org.contacts.map((c) => (
          <div key={c.id} className="task-row">
            <Link to={`/contacts/${c.id}`}>{c.name}</Link>
            <span style={{ color: 'var(--muted)' }}>{c.title}</span>
          </div>
        ))}
        {org.contacts.length === 0 && <div className="empty">No contacts yet.</div>}
      </div>
      <div className="card">
        <h2>Deals ({org.deals.length})</h2>
        {org.deals.map((d) => (
          <div key={d.id} className="task-row">
            <Link to={`/deals/${d.id}`}>{d.name}</Link>
            <span className={`badge badge-${d.stage}`}>{d.stage}</span>
          </div>
        ))}
        {org.deals.length === 0 && <div className="empty">No deals yet.</div>}
      </div>
    </div>
  );
}
