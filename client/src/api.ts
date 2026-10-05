import type {
  Activity,
  Contact,
  ContactDetail,
  ContactStatus,
  DashboardData,
  Deal,
  DealDetail,
  Organization,
  OrganizationDetail,
  Stage,
} from './types';

const BASE = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface OrgInput {
  name: string;
  website?: string;
  industry?: string;
  notes?: string;
}

export interface ContactInput {
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  organization_id?: number | null;
  status?: ContactStatus;
}

export interface DealInput {
  name: string;
  organization_id?: number | null;
  contact_id?: number | null;
  stage?: Stage;
  value?: number;
  probability?: number;
  close_date?: string;
}

export interface ActivityInput {
  type?: Activity['type'];
  contact_id?: number | null;
  deal_id?: number | null;
  description: string;
  happened_at?: string;
  due_date?: string;
  done?: boolean;
}

export const api = {
  auth: {
    me: async (): Promise<{ authenticated: boolean; username?: string; authDisabled?: boolean }> => {
      const res = await fetch(BASE + '/me');
      if (res.status === 401) return { authenticated: false };
      return (await res.json()) as { authenticated: boolean; username?: string; authDisabled?: boolean };
    },
    login: (username: string, password: string) =>
      req<{ ok: boolean; username: string }>('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    logout: () => req<{ ok: boolean }>('/logout', { method: 'POST' }),
  },
  organizations: {
    list: (search?: string) =>
      req<Organization[]>(`/organizations${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    get: (id: number) => req<OrganizationDetail>(`/organizations/${id}`),
    create: (d: OrgInput) => req<Organization>('/organizations', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: number, d: OrgInput) =>
      req<Organization>(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    remove: (id: number) => req<void>(`/organizations/${id}`, { method: 'DELETE' }),
  },
  contacts: {
    list: (search?: string, status?: string) => {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (status) q.set('status', status);
      const qs = q.toString();
      return req<Contact[]>(`/contacts${qs ? `?${qs}` : ''}`);
    },
    get: (id: number) => req<ContactDetail>(`/contacts/${id}`),
    create: (d: ContactInput) => req<Contact>('/contacts', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: number, d: ContactInput) =>
      req<Contact>(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    remove: (id: number) => req<void>(`/contacts/${id}`, { method: 'DELETE' }),
  },
  deals: {
    list: (search?: string) =>
      req<Deal[]>(`/deals${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    get: (id: number) => req<DealDetail>(`/deals/${id}`),
    create: (d: DealInput) => req<Deal>('/deals', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: number, d: DealInput) => req<Deal>(`/deals/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    setStage: (id: number, stage: Stage) =>
      req<Deal>(`/deals/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
    remove: (id: number) => req<void>(`/deals/${id}`, { method: 'DELETE' }),
  },
  activities: {
    list: (params?: { contact_id?: number; deal_id?: number }) => {
      const q = new URLSearchParams();
      if (params?.contact_id) q.set('contact_id', String(params.contact_id));
      if (params?.deal_id) q.set('deal_id', String(params.deal_id));
      const qs = q.toString();
      return req<Activity[]>(`/activities${qs ? `?${qs}` : ''}`);
    },
    create: (d: ActivityInput) => req<Activity>('/activities', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: number, d: Partial<ActivityInput>) =>
      req<Activity>(`/activities/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    remove: (id: number) => req<void>(`/activities/${id}`, { method: 'DELETE' }),
  },
  dashboard: () => req<DashboardData>('/dashboard'),
};
