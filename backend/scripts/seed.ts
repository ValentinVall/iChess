import { Pool } from 'pg';

/**
 * Seed script - populate initial data (optional)
 */
async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Seeding database...');

    // You can add initial data here
    // e.g., test users, etc.

    console.log('✅ Seed completed');
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
