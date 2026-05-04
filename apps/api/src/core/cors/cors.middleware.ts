import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

export function corsMiddleware(): MiddlewareHandler<{ Bindings: CloudflareBindings }> {
    return (c, next) => {
        const allowedOrigins = new Set(
            [
                c.env.FRONTEND_BASE_URL,
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                'https://front-smart.smart-agent.workers.dev',
            ].filter(Boolean),
        );

        return cors({
            allowHeaders: ['Content-Type', 'Authorization'],
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            maxAge: 600,
            credentials: true,
            origin: (origin) => (allowedOrigins.has(origin) ? origin : null),
        })(c, next);
    };
}
