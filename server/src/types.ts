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

/** Default probability of close (%) when a deal enters a stage. */
export const STAGE_PROBABILITY: Record<Stage, number> = {
  new: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0,
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
