const { Client } = require('pg');
const bcrypt = require('bcryptjs');

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
    console.log('Connected to DB.');
    
    // Get personnel table columns
    const colsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'personnel'
    `);
    console.log('Personnel Columns:', colsRes.rows.map(r => `${r.column_name} (${r.data_type})`));

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // Check if testadmin already exists, if so delete it
    await client.query("DELETE FROM personnel WHERE username = 'testadmin'");

    // Insert test admin
    const insertQuery = `
      INSERT INTO personnel (id, username, password, first_name, last_name, role, is_active)
      VALUES (gen_random_uuid(), 'testadmin', $1, 'Test', 'Admin', 'admin', true)
    `;
    await client.query(insertQuery, [hashedPassword]);
    console.log('Temporary testadmin user created with password: password123');

  } catch (err) {
    console.error('Failed:', err);
  } finally {
    await client.end();
  }
}

run();
