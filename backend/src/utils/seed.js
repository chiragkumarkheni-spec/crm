// Creates the first admin user. Run once after setting MONGODB_URI:
//   npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

async function run() {
  await connectDB();

  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@nexton.com').toLowerCase();
  const name = process.env.SEED_ADMIN_NAME || 'Admin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'changeme123';

  let user = await User.findOne({ email });
  if (user) {
    // eslint-disable-next-line no-console
    console.log(`Admin already exists: ${email}`);
  } else {
    user = new User({ name, email, role: 'admin' });
    await user.setPassword(password);
    await user.save();
    // eslint-disable-next-line no-console
    console.log(`Created admin: ${email} / password: ${password}`);
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
