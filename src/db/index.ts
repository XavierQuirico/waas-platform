// ============================================================
// Drizzle ORM — Conexión a la base de datos (Neon PostgreSQL)
// Stack: drizzle-orm + @neondatabase/serverless
//
// La conexión se abre la primera vez que se usa, no al importar el módulo:
// el build, los tests y el CI no necesitan DATABASE_URL.
// ============================================================

import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | null = null;

function connect(): Database {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set.');
    instance = drizzle(neon(url), { schema });
  }
  return instance;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = connect();
    const value = Reflect.get(database, property, database);
    return typeof value === 'function' ? value.bind(database) : value;
  },
});
