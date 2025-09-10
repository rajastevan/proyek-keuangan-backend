const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DB_DATABASE_URL, // Render akan menyediakan URL ini
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};