const path = require('path');
require('../../node_modules/dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const mysql = require('../../node_modules/mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'legal_practice'
  });

  console.log('Altering workforce_profiles.status enum to include INACTIVE and ON_LEAVE...');
  await conn.query(`
    ALTER TABLE workforce_profiles 
    MODIFY COLUMN status ENUM('DRAFT','ONBOARDING','ACTIVE','INACTIVE','ON_LEAVE','ON_NOTICE','SUSPENDED','EXITED','TERMINATED','CANCELLED','COMPLETED','EARLY_EXIT') 
    NOT NULL DEFAULT 'DRAFT'
  `);
  
  const [cols] = await conn.query("SHOW COLUMNS FROM workforce_profiles LIKE 'status'");
  console.log('New workforce_profiles.status TYPE:', cols[0].Type);

  await conn.end();
  console.log('Migration completed successfully.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
