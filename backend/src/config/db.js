const mongoose = require('mongoose');
const dns = require('dns');

// Some local networks/routers run a DNS resolver that refuses the SRV lookups
// that `mongodb+srv://` requires. If DNS_SERVERS is set (e.g. "8.8.8.8,1.1.1.1")
// use those resolvers instead. Not needed on Vercel (its DNS resolves SRV fine).
if (process.env.DNS_SERVERS) {
  dns.setServers(
    process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean)
  );
}

/**
 * Cached connection so that on a serverless platform (Vercel) we reuse the
 * same MongoDB connection across invocations instead of opening a new one
 * on every request.
 */
let cached = global.__mongoose;
if (!cached) {
  cached = global.__mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Add it to backend/.env');
  }

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        // Tuned for a serverless platform: fail fast if the cluster is
        // unreachable, keep a small reusable pool, and don't let a single slow
        // query hang the warm function forever.
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
        minPoolSize: 0,
        socketTimeoutMS: 20000,
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
