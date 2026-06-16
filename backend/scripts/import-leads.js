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

const args = process.argv.slice(2);
const DRY = args.includes('--dry'); // preview only, writes nothing to the database
const SET_CATALOGUE = args.includes('--catalogue'); // mark catalogue sent on every imported lead
const FORCE_TODAY = args.includes('--today'); // ignore the file's Lead Date, use today's date
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: node scripts/import-leads.js <path-to-xlsx> [--dry]');
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
// Handles "+91", spaces, dashes, a leading 0/91, and cells that contain TWO
// numbers (keeps the first valid 10-digit one and flags it for review).
function normalizeGroup(g) {
  let d = g.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
function cleanMobile(raw) {
  const original = String(raw == null ? '' : raw).trim();
  const hadLetters = /[a-zA-Z]/.test(original);
  // First treat the whole cell as ONE number (strip spaces/dashes/+91). A single
  // 10-digit number with stray spaces (e.g. "81477 35549") is the common case.
  const whole = normalizeGroup(original);
  if (whole.length === 10 && !hadLetters) {
    return { value: whole, needsReview: false, original };
  }
  // Otherwise split into separate number groups.
  const groups = original.split(/[\s,;/|]+/).filter(Boolean).map(normalizeGroup).filter((d) => d.length > 0);
  if (groups.length === 0) {
    return { value: original || '(missing)', needsReview: true, original };
  }
  if (groups.length === 1) {
    const d = groups[0];
    const needsReview = hadLetters || d.length !== 10;
    return { value: d, needsReview, original };
  }
  // Two or more genuine numbers in one cell — KEEP BOTH (separated by " / ") and
  // flag it, so neither contact is lost and the admin can review.
  return { value: groups.join(' / '), needsReview: true, original };
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

    const leadDate = FORCE_TODAY
      ? new Date()
      : parseDate(val(r, 'Lead Date (optional, DD-MM-YYYY)', 'Lead Date')) || new Date();

    if (!DRY) {
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
        ...(SET_CATALOGUE ? { catalogue: { sent: true, date: new Date() } } : {}),
      });
    }
    imported++;
  }

  console.log(`\n========== ${DRY ? 'DRY RUN (nothing saved)' : 'IMPORT COMPLETE'} ==========`);
  console.log(`${DRY ? 'Would import' : '✅ Imported'} leads:    ${imported}`);
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
