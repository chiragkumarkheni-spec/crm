export type Role = 'employee' | 'admin';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt?: string;
}

export type LeadStatus =
  | 'new'
  | 'in_progress'
  | 'no_pickup'
  | 'high_rate'
  | 'no_capacity'
  | 'retail_enquiry'
  | 'converted'
  | 'lost';

export type Outcome = Exclude<LeadStatus, 'new'>;

export interface SentFlag {
  sent: boolean;
  date?: string;
}

export interface Lead {
  _id: string;
  name?: string;
  companyName?: string;
  mobileNumber: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  product?: string;
  quantity?: string;
  requirement?: string;
  source?: string;
  createdBy?: User | string;
  assignedTo?: User | string;
  leadDate: string;
  status: LeadStatus;
  nextFollowUpDate?: string;
  followUpCount: number;
  lastFollowUpAt?: string;
  catalogue: SentFlag;
  sample: SentFlag & { description?: string };
  sampleRequest: { requested: boolean; description?: string; date?: string };
  whatsApp: SentFlag & { messageId?: string };
  convertedAt?: string;
  order: { value: number; currency: string; note?: string };
  notes?: string;
  createdAt: string;
}

export interface FollowUp {
  _id: string;
  lead: string;
  employee: User | string;
  date: string;
  outcome: Outcome;
  development: string;
  nextFollowUpDate?: string;
  orderValue?: number;
  catalogueSent: boolean;
  sampleSent: boolean;
  whatsAppSent: boolean;
  createdAt: string;
}

export interface ReportSummary {
  range: { from: string; to: string };
  newLeads: number;
  totalCalls: number;
  outcomes: Record<Outcome, number>;
  conversions: number;
  orderValue: number;
}

export interface EmployeeReportRow {
  employee: { _id: string; name?: string; email?: string };
  totalCalls: number;
  no_pickup: number;
  high_rate: number;
  no_capacity: number;
  retail_enquiry: number;
  in_progress: number;
  conversions: number;
  orderValue: number;
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  in_progress: 'In progress',
  no_pickup: 'No pickup',
  high_rate: 'Rate too high',
  no_capacity: 'No capacity',
  retail_enquiry: 'Retail enquiry',
  converted: 'Converted',
  lost: 'Lost',
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  ...OUTCOME_LABELS,
};
