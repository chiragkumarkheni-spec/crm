const { z } = require('zod');

// Validate req.body against a zod schema BEFORE the controller runs, returning a
// clean 400 with a human message on bad input. Schemas are `.passthrough()` so
// unknown keys are never stripped — this only rejects missing/malformed input and
// can never break a controller by removing a field it expects.
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(', ');
      res.status(400);
      return next(new Error(msg));
    }
    next();
  };
}

module.exports = { validate, z };
