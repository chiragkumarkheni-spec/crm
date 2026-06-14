// Date helpers. All "day" logic is based on the server's local day.
// NOTE: for a single-region (India) deployment this is fine. If you deploy the
// backend on Vercel, set the project's timezone via the TZ env var (e.g.
// TZ=Asia/Kolkata) so "today" matches the team's working day.

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isSameDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

// True if `d` is today (server day).
function isToday(d) {
  return isSameDay(d, new Date());
}

// True if `d` is strictly before today's start (i.e. a back-dated value).
function isBeforeToday(d) {
  return new Date(d) < startOfDay();
}

module.exports = { startOfDay, endOfDay, isSameDay, isToday, isBeforeToday };
