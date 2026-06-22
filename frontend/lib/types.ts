export type Role = 'employee' | 'admin';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  deviceId?: string | null;
  deviceBoundAt?: string;
  twoFactorEnabled?: boolean;
  deleted?: boolean;
  deletedAt?: string;
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
  mobileNeedsReview?: boolean;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  product?: string;
  quantity?: string;
  requirement?: string;
  source?: string;
  deleted?: boolean;
  deletedAt?: string;
  createdBy?: User | string;
  assignedTo?: User | string;
  leadDate: string;
  status: LeadStatus;
  strong?: boolean;
  strongAt?: string;
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

export interface Activity {
  _id: string;
  user: string;
  userName?: string;
  action: string;
  lead?: string;
  leadName?: string;
  detail?: string;
  createdAt: string;
}

export interface Distributor {
  _id: string;
  name: string;
  mobileNumber: string;
  companyName?: string;
  email?: string;
  city?: string;
  state?: string;
  address?: string;
  notes?: string;
  assignedTo?: User | string;
  callCount?: number;
  lastCallAt?: string;
  totalOrderValue?: number;
  nextFollowUpDate?: string;
  followUpCount?: number;
  createdAt: string;
}

export interface DistributorCall {
  _id: string;
  distributor: string;
  employee: User | string;
  category: string;
  direction: 'incoming' | 'outgoing';
  note?: string;
  orderValue?: number;
  date: string;
  createdAt: string;
}

export const DISTRIBUTOR_CATEGORIES: Record<string, string> = {
  new_order: 'New order',
  payment: 'Payment',
  marketing: 'Marketing service',
  complaint: 'Complaint',
  rate: 'Rate discussion',
  product_info: 'Product info',
  general: 'General talk',
  other: 'Other',
};

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
  cataloguesSent: number;
  distributorCalls: number;
  distributorOrderValue: number;
  monthlyConversions: number;
  monthlyOrderValue: number;
  monthlyDistributorCalls: number;
  monthlyDistributorOrderValue: number;
  strongTotal: number;
  strongInPeriod: number;
}

export interface DistributorCallDetail {
  _id: string;
  employee?: { _id: string; name?: string };
  distributor?: { _id: string; name?: string; mobileNumber?: string; companyName?: string };
  category: string;
  direction: 'incoming' | 'outgoing';
  note?: string;
  orderValue?: number;
  date: string;
}

export interface EmployeeReportRow {
  employee: { _id: string; name?: string; email?: string };
  // Lead inventory (all-time)
  leadsTotal: number;
  leadsNew: number;
  leadsInProgress: number;
  leadsConverted: number;
  leadsLost: number;
  cataloguesSent: number;
  // Activity (selected period)
  totalCalls: number;
  no_pickup: number;
  high_rate: number;
  no_capacity: number;
  retail_enquiry: number;
  in_progress: number;
  conversions: number;
  orderValue: number;
  distributorCalls: number;
  distributorOrderValue: number;
  totalAllCalls: number;
  totalSales: number;
  strongTotal: number;
  strongNew: number;
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
