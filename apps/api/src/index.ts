import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { StatusCodes } from 'http-status-codes';
import { customLogger } from './core/logger';
import { corsMiddleware } from './core/cors';
import { statsMiddleware } from './core/stats';
import { _auth } from './features/auth';
import { router } from './routes';
import { mountOpenApi } from './core/openapi';

const app = new Hono<{ Bindings: CloudflareBindings }>();

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

export default app;
