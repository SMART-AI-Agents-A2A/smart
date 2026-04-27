import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from '../user/user.model';

export const sessions = sqliteTable('sessions', {
    id: text().primaryKey(),
    token: text().notNull().unique(),
    user_id: text()
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    ip_address: text(),
    user_agent: text(),
    expires_at: integer({ mode: 'timestamp' }).notNull(),
    created_at: integer({ mode: 'timestamp' }).default(sql`(unixepoch())`),
    updated_at: integer({ mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const accounts = sqliteTable('accounts', {
    id: text().primaryKey(),
    account_id: text().notNull(),
    provider_id: text().notNull(),
    user_id: text()
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    access_token: text(),
    refresh_token: text(),
    id_token: text(),
    access_token_expires_at: integer({ mode: 'timestamp' }),
    refresh_token_expires_at: integer({ mode: 'timestamp' }),
    scope: text(),
    password: text(),
    created_at: integer({ mode: 'timestamp' }).default(sql`(unixepoch())`),
    updated_at: integer({ mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const verifications = sqliteTable('verifications', {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expires_at: integer({ mode: 'timestamp' }).notNull(),
    created_at: integer({ mode: 'timestamp' }).default(sql`(unixepoch())`),
    updated_at: integer({ mode: 'timestamp' }).default(sql`(unixepoch())`),
});
