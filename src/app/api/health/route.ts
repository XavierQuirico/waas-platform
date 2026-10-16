import { sql } from 'drizzle-orm';
import { db } from '@/db';

export async function GET() {
  try {
    // Simple query to verify database connection is alive
    await db.execute(sql`SELECT 1`);
    return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return new Response(JSON.stringify({ status: 'error', timestamp: new Date().toISOString() }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
