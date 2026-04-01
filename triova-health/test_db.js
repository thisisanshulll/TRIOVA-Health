const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://triova_admin:triova_secret_dev@127.0.0.1:5432/triova_health'
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) { console.error('Connection error:', err.stack); }
  else { console.log('Connected! Server time:', res.rows[0].now); }
  pool.end();
});
