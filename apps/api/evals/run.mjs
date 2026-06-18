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
    const { runPromptEval } = await server.ssrLoadModule('/evals/run.ts');
    await runPromptEval(process.argv.slice(2));
} finally {
    await server.close();
}
