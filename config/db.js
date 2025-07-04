// config/db.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase
  },
});

// Optional: test connection
pool.connect()
  .then(() => console.log("✅ Connected to Supabase database"))
  .catch((err) => console.error("❌ Failed to connect to DB", err));

module.exports = pool;
