import { defineConfig } from 'drizzle-kit';

// vp run api#db-migrate:prod
export default defineConfig({
    schema: './src/core/db/schema.ts',
    out: './database',
    dialect: 'sqlite',
    driver: 'd1-http',
    dbCredentials: {
        accountId: 'db91ef648c1b228cdb5fe3d089c732b1',
        databaseId: 'df627812-ad5b-485c-8b85-179fffaa1629',
        token: 'cfat_0g7JeZB1A4AMGwrvFSDvBJ3R2AmeJCxaHMva1nf11d3bcf2d',
    },
});
