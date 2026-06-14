// Vercel serverless entry point for the Express API.
// Vercel turns this file into a single serverless function and we route
// every request to it via vercel.json.
require('dotenv').config();
const app = require('../src/app');

module.exports = app;
