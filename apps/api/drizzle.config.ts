import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/core/db/schema.ts',
    out: './database',
    dialect: 'sqlite',
    dbCredentials: {
        url: '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/0b44df2f180e10f49c5f3a30f8554b761b5992ef89db48cb3b1ea7823c842282.sqlite',
    },
});
