require('dotenv').config();
// Keep "today"/edit-lock logic on India time regardless of where the server runs.
process.env.TZ = process.env.TZ || 'Asia/Kolkata';
const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Nexton CRM API running on http://localhost:${PORT}`);
});
