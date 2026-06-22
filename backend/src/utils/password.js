// One place for the password strength rule, so creating a user, an admin reset
// and a self-service change all enforce the SAME policy.
//
// Returns a human (Hinglish) error message if the password is too weak, or null
// if it is acceptable. Rule: at least 8 characters with at least one letter and
// one number. A special character is recommended but not forced (these are
// non-technical reps — over-strict rules just lead to written-down passwords).
function passwordError(plain) {
  const p = String(plain == null ? '' : plain);
  if (p.length < 8) return 'Password kam se kam 8 character ka hona chahiye';
  if (!/[A-Za-z]/.test(p)) return 'Password me kam se kam ek letter (a-z) hona chahiye';
  if (!/[0-9]/.test(p)) return 'Password me kam se kam ek number (0-9) hona chahiye';
  return null;
}

module.exports = { passwordError };
