// --- Request hardening middleware ---
//
// NoSQL operator-injection guard. MongoDB treats keys that start with "$"
// (e.g. $ne, $gt, $where) as query OPERATORS, and dotted keys ("a.b") as nested
// paths. If those reach a query straight from user input — e.g. a crafted URL
// like ?status[$ne]=x or a JSON body {"email": {"$gt": ""}} — an attacker could
// bend a query to match rows they should not see, or bypass a check.
//
// This walks the body / query / params of every request and deletes any key that
// starts with "$" or contains ".". After this runs, user input can only ever be
// a plain value (or a clean nested object), never a Mongo operator. No extra npm
// package needed; it covers EVERY route in one place.
function stripKeys(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
      continue;
    }
    const val = obj[key];
    if (val && typeof val === 'object') stripKeys(val, depth + 1);
  }
}

function mongoSanitize(req, _res, next) {
  // req.query / req.params objects are mutable in Express 4 — clean in place so
  // the same (sanitized) object the framework built is what controllers read.
  stripKeys(req.body);
  stripKeys(req.query);
  stripKeys(req.params);
  next();
}

// Escape a user-supplied string so it is matched LITERALLY inside a RegExp.
// Without this, characters like ( ) [ ] * + ? could either change the meaning of
// a search or, worse, build a "catastrophic backtracking" pattern that pins the
// CPU at 100% (a ReDoS denial-of-service) from a single search box.
function escapeRegex(str) {
  return String(str == null ? '' : str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { mongoSanitize, escapeRegex };
