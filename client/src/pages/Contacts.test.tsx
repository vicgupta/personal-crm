import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Contacts from './Contacts';

const CONTACTS = [
  { id: 1, name: 'Alice Anderson', email: 'alice@example.com', phone: '', title: 'CEO', organization_id: 1, organization_name: 'Acme', status: 'lead', created_at: '' },
  { id: 2, name: 'Bob Brown', email: 'bob@example.com', phone: '', title: 'CTO', organization_id: 1, organization_name: 'Acme', status: 'customer', created_at: '' },
  { id: 3, name: 'Carol Clark', email: 'carol@example.com', phone: '', title: 'CFO', organization_id: null, organization_name: null, status: 'qualified', created_at: '' },
];

function installFetch() {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    calls.push(`${init?.method ?? 'GET'} ${url.pathname}${url.search}`);
    let body: unknown = [];
    if (url.pathname === '/api/contacts' && !init?.method) {
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const status = url.searchParams.get('status') ?? '';
      body = CONTACTS.filter(
        (c) =>
          (!search || c.name.toLowerCase().includes(search) || c.email.toLowerCase().includes(search)) &&
          (!status || c.status === status),
      );
    } else if (url.pathname === '/api/organizations') {
      body = [{ id: 1, name: 'Acme' }];
    } else if (url.pathname === '/api/contacts/1' && init?.method === 'DELETE') {
      return { ok: true, status: 204, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Contacts />
    </MemoryRouter>,
  );
}

describe('Contacts page', () => {
  beforeEach(() => { installFetch(); });
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('lists contacts loaded from the API', async () => {
    renderPage();
    expect(await screen.findByText('Alice Anderson')).toBeInTheDocument();
    expect(screen.getByText('Bob Brown')).toBeInTheDocument();
    expect(screen.getByText('Carol Clark')).toBeInTheDocument();
  });

  it('narrows the list as you type in the search box', async () => {
    renderPage();
    await screen.findByText('Alice Anderson');
    fireEvent.change(screen.getByLabelText('Search contacts'), { target: { value: 'bob' } });
    await waitFor(() => expect(screen.queryByText('Alice Anderson')).not.toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByText('Bob Brown')).toBeInTheDocument();
    expect(screen.queryByText('Carol Clark')).not.toBeInTheDocument();
  });

  it('filters contacts by status', async () => {
    renderPage();
    await screen.findByText('Alice Anderson');
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'customer' } });
    await waitFor(() => expect(screen.queryByText('Alice Anderson')).not.toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByText('Bob Brown')).toBeInTheDocument();
  });

  it('deletes a contact after confirmation and reloads', async () => {
    const { calls } = installFetch();
    renderPage();
    await screen.findByText('Alice Anderson');
    const row = screen.getByText('Alice Anderson').closest('tr')!;
    fireEvent.click(within(row).getByLabelText('Delete Alice Anderson'));
    expect(await screen.findByText(/Delete "Alice Anderson"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(calls.some((c) => c === 'DELETE /api/contacts/1')).toBe(true);
    });
  });
});
