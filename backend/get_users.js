const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'security_management'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB. Querying personnel...');
    const res = await client.query("SELECT username, first_name, last_name, role, is_active FROM personnel WHERE deleted_at IS NULL");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Query failed:', err);
  } finally {
    await client.end();
  }
}

run();
