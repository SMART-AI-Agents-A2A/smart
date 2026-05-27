import { defineConfig } from 'drizzle-kit';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LOCAL_D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const LOCAL_D1_FALLBACK_FILE = join(LOCAL_D1_DIR, 'local.sqlite');

function requiresLocalD1File() {
    const command = process.argv.slice(2).join(' ');

    return /\b(migrate|studio|push|pull|introspect)\b/.test(command);
}

function missingLocalD1FileError() {
    return new Error(
        `No local D1 sqlite file found in ${LOCAL_D1_DIR}. Start the API dev server first (vp run api#dev).`,
    );
}

function resolveLocalD1File() {
    if (!existsSync(LOCAL_D1_DIR)) {
        if (requiresLocalD1File()) {
            throw missingLocalD1FileError();
        }

        return LOCAL_D1_FALLBACK_FILE;
    }

    const candidates = readdirSync(LOCAL_D1_DIR)
        .filter((file) => file.endsWith('.sqlite') && file !== 'metadata.sqlite')
        .map((file) => ({
            file,
            path: join(LOCAL_D1_DIR, file),
            mtimeMs: statSync(join(LOCAL_D1_DIR, file)).mtimeMs,
        }))
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (candidates.length === 0) {
        if (requiresLocalD1File()) {
            throw missingLocalD1FileError();
        }

        return LOCAL_D1_FALLBACK_FILE;
    }

    return candidates[0].path;
}

export default defineConfig({
    schema: './src/core/db/schema.ts',
    out: './database',
    dialect: 'sqlite',
    dbCredentials: {
        url: resolveLocalD1File(),
    },
});
