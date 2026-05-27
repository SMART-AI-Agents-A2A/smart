import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { StatusCodes } from 'http-status-codes';
import { routeAgentRequest } from 'agents';
import { customLogger } from './core/logger';
import { corsMiddleware } from './core/cors';
import { statsMiddleware } from './core/stats';
import { _auth } from './features/auth';
import { router } from './routes';
import { mountOpenApi } from './core/openapi';
import { refreshAll } from './features/cache';
import { SmartAgent } from './features/ai';

export { SmartAgent };

const app = new Hono<{ Bindings: CloudflareBindings }>();
let startupRefreshScheduled = false;

app.use('*', logger(customLogger));
app.use('*', corsMiddleware());
app.on('GET', ['/', '/v1/'], statsMiddleware());

mountOpenApi(app);

app.options('*', (c) => {
    c.status(StatusCodes.NO_CONTENT);
    return c.body('');
});

app.on('GET', '/v1/auth/google/callback', (c) => {
    const url = new URL(c.req.url);
    url.pathname = '/v1/auth/callback/google';
    const request = new Request(url.toString(), c.req.raw);
    return _auth.handler(request);
});

app.on(['POST', 'GET'], '/v1/auth/*', (c) => _auth.handler(c.req.raw));

app.route('/v1', router);

const handler = {
    async fetch(request: Request, env: CloudflareBindings, context: ExecutionContext) {
        const agentResponse = await routeAgentRequest(request, env);
        if (agentResponse) return agentResponse;

        if (!startupRefreshScheduled) {
            startupRefreshScheduled = true;
            context.waitUntil(refreshAll(env, { trigger: 'startup' }));
        }

        return app.fetch(request, env, context);
    },
    scheduled(
        _controller: ScheduledController,
        env: CloudflareBindings,
        context: ExecutionContext,
    ) {
        context.waitUntil(refreshAll(env, { trigger: 'scheduled' }));
    },
} satisfies ExportedHandler<CloudflareBindings>;

export default handler;
