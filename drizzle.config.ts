import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

// Same resolution order as the app: .env.local first, then .env.
dotenv.config({ path: '.env.local' });
dotenv.config();

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
