import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, type DealInput } from '../api';
import { useDebounce } from '../hooks';
import { STAGE_LABELS, formatDate, formatMoney, type Contact, type Deal, type Organization } from '../types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import DealForm from '../components/DealForm';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Deals() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState<Deal | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const debouncedSearch = useDebounce(search);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ds, os, cs] = await Promise.all([
        api.deals.list(debouncedSearch || undefined),
        api.organizations.list(),
        api.contacts.list(),
      ]);
      setDeals(ds);
      setOrganizations(os);
      setContacts(cs);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const submit = async (data: DealInput) => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) await api.deals.update(editing.id, data);
      else await api.deals.create(data);
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
    await api.deals.remove(deleting.id);
    setDeleting(null);
    await load();
  };

  const columns = useMemo<ColumnDef<Deal, unknown>[]>(() => [
    { accessorKey: 'name', header: 'Deal' },
    { accessorKey: 'organization_name', header: 'Organization' },
    { accessorKey: 'contact_name', header: 'Contact' },
    {
      accessorKey: 'stage',
      header: 'Stage',
      cell: ({ row }) => <span className={`badge badge-${row.original.stage}`}>{STAGE_LABELS[row.original.stage]}</span>,
    },
    {
      accessorKey: 'value',
      header: 'Value',
      cell: ({ row }) => formatMoney(row.original.value),
    },
    {
      accessorKey: 'close_date',
      header: 'Close date',
      cell: ({ row }) => formatDate(row.original.close_date),
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
        <div><h1>Deals</h1><p>{deals.length} deals · {formatMoney(deals.reduce((n, d) => n + d.value, 0))} total</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus />Add deal</button>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="card">
        <div className="toolbar">
          <div className="search-box">
            <Search />
            <input
              type="text"
              placeholder="Search deals…"
              aria-label="Search deals"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {loading ? <div className="loading">Loading…</div> : (
          <DataTable
            columns={columns}
            data={deals}
            onRowClick={(d) => navigate(`/deals/${d.id}`)}
            emptyText="No deals found."
          />
        )}
      </div>

      {showAdd && (
        <Modal title="Add deal" onClose={() => setShowAdd(false)}>
          <DealForm organizations={organizations} contacts={contacts} onSubmit={submit} onCancel={() => setShowAdd(false)} saving={saving} error={formError} />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit deal" onClose={() => setEditing(null)}>
          <DealForm initial={editing} organizations={organizations} contacts={contacts} onSubmit={submit} onCancel={() => setEditing(null)} saving={saving} error={formError} />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete deal"
          message={`Delete "${deleting.name}"? Its activities will be removed too.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
