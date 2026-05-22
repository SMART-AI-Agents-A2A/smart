import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

export const UserRoleEnum = z.enum(['admin', 'manager', 'editor', 'viewer']);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const users = sqliteTable('users', {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text()
        .notNull()
        .unique()
        .$default(() => sql`COLLATE NOCASE`),
    email_verified: integer({ mode: 'boolean' }).notNull().default(false),
    image: text(),
    role: text({ enum: UserRoleEnum.options as [string, ...string[]] })
        .notNull()
        .default('viewer'),
    first_login: integer({ mode: 'boolean' }).notNull().default(true),
    created_at: integer({ mode: 'timestamp' }).default(sql`(unixepoch())`),
    updated_at: integer({ mode: 'timestamp' }).default(sql`(unixepoch())`),
});
