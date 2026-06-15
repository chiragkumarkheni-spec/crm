// Vercel serverless entry point for the Express API.
// Vercel turns this file into a single serverless function and we route
// every request to it via vercel.json.
require('dotenv').config();
// Run all date logic in India time so "today", the same-day edit lock and the
// daily follow-up list match the team's working day (the server runs in UTC by
// default on Vercel). An explicit TZ env var, if set, still wins.
process.env.TZ = process.env.TZ || 'Asia/Kolkata';
const app = require('../src/app');

module.exports = app;
