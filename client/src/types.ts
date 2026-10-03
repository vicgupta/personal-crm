export const STAGES = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  new: 'New',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export const CONTACT_STATUSES = ['lead', 'qualified', 'customer'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const ACTIVITY_TYPES = ['note', 'call', 'email'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Organization {
  id: number;
  name: string;
  website: string;
  industry: string;
  notes: string;
  created_at: string;
}

export interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  title: string;
  organization_id: number | null;
  status: ContactStatus;
  created_at: string;
  organization_name?: string | null;
}

export interface Deal {
  id: number;
  name: string;
  organization_id: number | null;
  contact_id: number | null;
  stage: Stage;
  value: number;
  probability: number;
  close_date: string;
  created_at: string;
  organization_name?: string | null;
  contact_name?: string | null;
}

export interface Activity {
  id: number;
  type: ActivityType;
  contact_id: number | null;
  deal_id: number | null;
  description: string;
  happened_at: string;
  due_date: string;
  done: boolean;
  created_at: string;
  contact_name?: string | null;
  deal_name?: string | null;
}

export interface OrganizationDetail extends Organization {
  contacts: Contact[];
  deals: Deal[];
}

export interface ContactDetail extends Contact {
  organization: Organization | null;
  activities: Activity[];
}

export interface DealDetail extends Deal {
  organization: Organization | null;
  contact: Contact | null;
  activities: Activity[];
}

export interface DashboardData {
  wonByMonth: { month: string; deals: number; revenue: number }[];
  pipeline: { stage: Stage; count: number; totalValue: number; expectedValue: number }[];
  recentActivities: Activity[];
  upcomingTasks: Activity[];
  overdueTasks: Activity[];
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
