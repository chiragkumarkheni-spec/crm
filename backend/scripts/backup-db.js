// Full database backup -> local JSON files. Atlas free (M0) has no automated
// backups, so run this whenever you want a safety copy.
//
// Usage (from the backend folder):
//   node scripts/backup-db.js            # saves to backend/backups/backup-<date>/
//   node scripts/backup-db.js --out=D:/my-backups
//
// Each collection becomes one .json file. To restore later, the same docs can be
// re-inserted (ask before doing a restore — it overwrites live data).
require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Kolkata';
const dns = require('dns');
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean));
}
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const pad = (n) => String(n).padStart(2, '0');

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set in backend/.env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;

  const now = new Date();
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}`;

  const outArg = (process.argv.find((a) => a.startsWith('--out=')) || '').split('=')[1];
  const baseDir = outArg || path.join(__dirname, '..', 'backups');
  const dir = path.join(baseDir, `backup-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });

  const cols = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.'));

  console.log(`Backing up ${cols.length} collections to:\n  ${dir}\n`);
  let totalDocs = 0;
  for (const name of cols) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(docs, null, 2));
    totalDocs += docs.length;
    console.log(`  ${name}: ${docs.length} docs`);
  }

  // A small manifest so a future restore knows what this folder holds.
  fs.writeFileSync(
    path.join(dir, '_manifest.json'),
    JSON.stringify({ takenAt: now.toISOString(), collections: cols, totalDocs }, null, 2)
  );

  console.log(`\n✅ Backup done — ${totalDocs} documents across ${cols.length} collections.`);
  console.log(`   Folder: ${dir}`);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('Backup failed:', e.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
