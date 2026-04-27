import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:workers';
import * as schema from './schema';

export const _db = drizzle(env.DB, { schema });
export * from './schema';
