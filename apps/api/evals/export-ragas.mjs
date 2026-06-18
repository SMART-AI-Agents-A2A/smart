import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
    root,
    configFile: false,
    envFile: false,
    appType: 'custom',
    server: {
        hmr: false,
        middlewareMode: true,
        watch: {
            ignored: ['**/.env', '**/.dev.vars', '**/.wrangler/**'],
        },
    },
});

try {
    const { runRagasExport } = await server.ssrLoadModule('/evals/export-ragas.ts');
    await runRagasExport(process.argv.slice(2));
} finally {
    await server.close();
}
