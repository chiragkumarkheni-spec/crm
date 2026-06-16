// Bulk-import leads from the filled Excel template.
// Usage (from the backend folder, with backend/.env set up):
//   npm install xlsx        # once, if not already installed
//   node scripts/import-leads.js "../Nexton-Leads-Import-Template.xlsx"
//
// Philosophy: NEVER drop a contact. Mobile numbers are auto-cleaned; if one still
// looks unusual it is imported anyway and flagged (mobileNeedsReview) so it shows
// up in the warning list below for the admin to fix later.
require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

const XLSX = require('xlsx');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/import-leads.js <path-to-xlsx>');
  process.exit(1);
}

// Pull a value for any of the given possible header names.
function val(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
  }
  return '';
}

// Clean an Indian mobile number without ever discarding the row.
function cleanMobile(raw) {
  const original = String(raw == null ? '' : raw).trim();
  const hadLetters = /[a-zA-Z]/.test(original);
  let digits = original.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  const needsReview = hadLetters || digits.length !== 10;
  // Store cleaned digits; if there were none, keep the original so nothing is lost.
  const value = digits.length > 0 ? digits : original || '(missing)';
  return { value, needsReview, original };
}

function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date && !isNaN(raw)) return raw;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d));
    return isNaN(dt) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
}

(async () => {
  await connectDB();

  const wb = XLSX.readFile(file, { cellDates: true });
  const ws = wb.Sheets['Leads'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const users = await User.find({}).select('name email role').lean();
  const byEmail = new Map(users.map((u) => [String(u.email).toLowerCase(), u]));
  const admin = users.find((u) => u.role === 'admin');

  const mobileWarnings = [];
  const repWarnings = [];
  const skipped = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // +1 header, +1 to make it 1-based like Excel

    const name = val(r, 'Buyer Name *', 'Buyer Name');
    const mobileRaw = val(r, 'Mobile Number *', 'Mobile Number');
    // An entirely empty row — skip silently.
    if (!name && !mobileRaw) continue;
    if (!name) {
      skipped.push({ rowNum, reason: 'missing Buyer Name' });
      continue;
    }

    const m = cleanMobile(mobileRaw);
    if (m.needsReview) {
      mobileWarnings.push({ rowNum, name, original: m.original || '(blank)', stored: m.value });
    }

    const repEmail = val(r, 'Rep Email *', 'Rep Email').toLowerCase();
    let owner = byEmail.get(repEmail);
    if (!owner) {
      repWarnings.push({ rowNum, name, repEmail: repEmail || '(blank)' });
      owner = admin; // fallback so the lead is never lost; admin can reassign later
    }

    const leadDate = parseDate(val(r, 'Lead Date (optional, DD-MM-YYYY)', 'Lead Date')) || new Date();

    await Lead.create({
      name,
      companyName: val(r, 'Company Name'),
      mobileNumber: m.value,
      mobileNeedsReview: m.needsReview,
      email: val(r, 'Email'),
      city: val(r, 'City'),
      address: val(r, 'Address'),
      state: val(r, 'State'),
      product: val(r, 'Product Required'),
      quantity: val(r, 'Quantity'),
      requirement: val(r, 'Requirement / Message'),
      source: val(r, 'Source') || 'IndiaMart',
      createdBy: (admin && admin._id) || owner._id,
      assignedTo: owner._id,
      leadDate,
      status: 'new',
    });
    imported++;
  }

  console.log('\n========== IMPORT COMPLETE ==========');
  console.log(`✅ Imported leads:        ${imported}`);
  console.log(`⏭  Skipped (no name):     ${skipped.length}`);
  console.log(`⚠️  Mobile needs review:   ${mobileWarnings.length}`);
  console.log(`⚠️  Rep email not matched: ${repWarnings.length}  (these went to Admin — reassign later)`);

  if (mobileWarnings.length) {
    console.log('\n--- MOBILE WARNINGS (imported, please review) ---');
    mobileWarnings.forEach((w) =>
      console.log(`  row ${w.rowNum}  ${w.name}  |  entered: "${w.original}"  ->  stored: "${w.stored}"`)
    );
  }
  if (repWarnings.length) {
    console.log('\n--- REP EMAIL NOT FOUND (assigned to Admin) ---');
    repWarnings.forEach((w) => console.log(`  row ${w.rowNum}  ${w.name}  |  rep: "${w.repEmail}"`));
  }
  if (skipped.length) {
    console.log('\n--- SKIPPED ROWS ---');
    skipped.forEach((s) => console.log(`  row ${s.rowNum}  (${s.reason})`));
  }

  await mongoose.disconnect();
  console.log('\nDone.');
})().catch(async (err) => {
  console.error('Import failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
