// Generates the Excel template that reps/admin fill in to bulk-import leads.
// Run from the backend folder:  node scripts/generate-import-template.js
const path = require('path');
const XLSX = require('xlsx');

// --- Sheet 1: Leads (the sheet to fill) ---
const headers = [
  'Buyer Name *',
  'Mobile Number *',
  'Rep Email *',
  'Company Name',
  'Email',
  'City',
  'State',
  'Address',
  'Product Required',
  'Quantity',
  'Requirement / Message',
  'Source',
  'Lead Date (optional, DD-MM-YYYY)',
];

const examples = [
  ['Ramesh Patel', '9876543210', 'abhipatel@gmail.com', 'Patel Trading Co.', 'ramesh@example.com', 'Surat', 'Gujarat', 'GIDC Road, Surat', 'Engine Oil 20W-40', '200 Litre', 'Need monthly supply for our garage', 'IndiaMart', ''],
  ['Suresh Kumar', '9123456780', 'vipulchhotala@gmail.com', 'Kumar Auto Spares', '', 'Rajkot', 'Gujarat', '', 'Gear Oil EP90', '100 Litre', 'Asked for rate list', 'TradeIndia', ''],
];

const leadsWs = XLSX.utils.aoa_to_sheet([headers, ...examples]);
leadsWs['!cols'] = headers.map((h) => ({ wch: Math.max(16, h.length + 2) }));

// --- Sheet 2: Instructions + rep emails + column guide ---
const reps = [
  ['VIPULCHHOTALA', 'vipulchhotala@gmail.com'],
  ['ABHIKORAT', 'abhikorat@gmail.com'],
  ['PIYUSH VAGHASIYA', 'piyushvaghasiya@gmail.com'],
  ['abhishek', 'abhipatel@gmail.com'],
];

const instr = [
  ['Nexton CRM — Leads Import Template'],
  [''],
  ['HOW TO USE'],
  ['1. Fill ONE lead per row in the "Leads" sheet. Delete the two example rows first.'],
  ['2. Columns marked * are REQUIRED: Buyer Name, Mobile Number, Rep Email.'],
  ['3. Mobile Number: best is 10 digits, but DON\'T WORRY — no contact is ever dropped.'],
  ['   The system auto-cleans it (removes spaces, dashes, +91). If it still looks odd'],
  ['   (more/less than 10 digits, or has letters) the lead is STILL imported and just'],
  ['   added to a "needs review" warning list so you can fix it later.'],
  ['4. Rep Email = the employee who owns this lead. It MUST be one of the emails listed below.'],
  ['5. Source can be: IndiaMart / TradeIndia / JustDial / Reference / Walk-in / Other.'],
  ['6. Lead Date is optional (format DD-MM-YYYY). Leave it blank to use the upload day.'],
  ['7. Save the file and send it back — it will be loaded into the CRM in one go.'],
  [''],
  ['REP EMAILS — assign each lead to one of these employees:'],
  ['Name', 'Email'],
  ...reps,
  [''],
  ['COLUMN GUIDE'],
  ['Column', 'Meaning'],
  ['Buyer Name *', 'Contact person name (required)'],
  ['Mobile Number *', 'Required. 10 digits preferred; odd ones are auto-cleaned + flagged, never dropped.'],
  ['Rep Email *', 'Employee who owns the lead (required) — from the list above'],
  ['Company Name', 'Firm / company name'],
  ['Email', 'Buyer email (optional)'],
  ['City', 'City'],
  ['State', 'State (e.g. Gujarat)'],
  ['Address', 'Full address'],
  ['Product Required', 'e.g. Engine Oil 20W-40'],
  ['Quantity', 'e.g. 200 Litre'],
  ['Requirement / Message', 'The enquiry / requirement text'],
  ['Source', 'Where the lead came from'],
  ['Lead Date', 'Optional, DD-MM-YYYY. Blank = upload day.'],
];
const instrWs = XLSX.utils.aoa_to_sheet(instr);
instrWs['!cols'] = [{ wch: 30 }, { wch: 60 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, leadsWs, 'Leads');
XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');

const out = path.join(__dirname, '..', '..', 'Nexton-Leads-Import-Template.xlsx');
XLSX.writeFile(wb, out);
console.log('Template written to:', out);
