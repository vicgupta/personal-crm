import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, type OrgInput } from '../api';
import { useDebounce } from '../hooks';
import type { Organization } from '../types';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import OrgForm from '../components/OrgForm';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Organizations() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState<Organization | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const debouncedSearch = useDebounce(search);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrgs(await api.organizations.list(debouncedSearch || undefined));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const submit = async (data: OrgInput) => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) await api.organizations.update(editing.id, data);
      else await api.organizations.create(data);
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
    await api.organizations.remove(deleting.id);
    setDeleting(null);
    await load();
  };

  const columns = useMemo<ColumnDef<Organization, unknown>[]>(() => [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'website', header: 'Website' },
    { accessorKey: 'industry', header: 'Industry' },
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
        <div><h1>Organizations</h1><p>{orgs.length} companies</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus />Add organization</button>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="card">
        <div className="toolbar">
          <div className="search-box">
            <Search />
            <input
              type="text"
              placeholder="Search organizations…"
              aria-label="Search organizations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {loading ? <div className="loading">Loading…</div> : (
          <DataTable
            columns={columns}
            data={orgs}
            onRowClick={(o) => navigate(`/organizations/${o.id}`)}
            emptyText="No organizations found."
          />
        )}
      </div>

      {showAdd && (
        <Modal title="Add organization" onClose={() => setShowAdd(false)}>
          <OrgForm onSubmit={submit} onCancel={() => setShowAdd(false)} saving={saving} error={formError} />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit organization" onClose={() => setEditing(null)}>
          <OrgForm initial={editing} onSubmit={submit} onCancel={() => setEditing(null)} saving={saving} error={formError} />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete organization"
          message={`Delete "${deleting.name}"? Its contacts and deals will be kept but unlinked.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
