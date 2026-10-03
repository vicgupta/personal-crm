import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, type ContactInput } from '../api';
import { useDebounce } from '../hooks';
import { CONTACT_STATUSES, type Contact, type Organization } from '../types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ContactForm from '../components/ContactForm';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Contacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const debouncedSearch = useDebounce(search);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cs, os] = await Promise.all([
        api.contacts.list(debouncedSearch || undefined, statusFilter || undefined),
        api.organizations.list(),
      ]);
      setContacts(cs);
      setOrganizations(os);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const submit = async (data: ContactInput) => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) await api.contacts.update(editing.id, data);
      else await api.contacts.create(data);
      setShowAdd(false);
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await api.contacts.remove(deleting.id);
    setDeleting(null);
    await load();
  };

  const columns = useMemo<ColumnDef<Contact, unknown>[]>(() => [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'organization_name', header: 'Organization' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <span className={`badge badge-${row.original.status}`}>{row.original.status}</span>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="row-actions">
          <button className="icon-btn" title="Edit" aria-label={`Edit ${row.original.name}`}
            onClick={() => setEditing(row.original)}><Pencil /></button>
          <button className="icon-btn danger" title="Delete" aria-label={`Delete ${row.original.name}`}
            onClick={() => setDeleting(row.original)}><Trash2 /></button>
        </div>
      ),
    },
  ], []);

  return (
    <div>
      <div className="page-header">
        <div><h1>Contacts</h1><p>{contacts.length} people</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus />Add contact</button>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="card">
        <div className="toolbar">
          <div className="search-box">
            <Search />
            <input
              type="text"
              placeholder="Search name, email, title…"
              aria-label="Search contacts"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All statuses</option>
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        {loading ? <div className="loading">Loading…</div> : (
          <DataTable
            columns={columns}
            data={contacts}
            onRowClick={(c) => navigate(`/contacts/${c.id}`)}
            emptyText="No contacts found."
          />
        )}
      </div>

      {showAdd && (
        <Modal title="Add contact" onClose={() => setShowAdd(false)}>
          <ContactForm organizations={organizations} onSubmit={submit} onCancel={() => setShowAdd(false)} saving={saving} error={formError} />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit contact" onClose={() => setEditing(null)}>
          <ContactForm initial={editing} organizations={organizations} onSubmit={submit} onCancel={() => setEditing(null)} saving={saving} error={formError} />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete contact"
          message={`Delete "${deleting.name}"? Their activities will be removed too.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
