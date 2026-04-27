import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

export function corsMiddleware(): MiddlewareHandler {
    return (c, next) => {
        const isProduction = c.env.production;

        if (isProduction) {
            return cors({
                allowHeaders: ['Content-Type'],
                allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                maxAge: 600,
                credentials: true,
                origin: (origin) => {
                    const allowedOrigins = ['https://front-smart.smart-agent.workers.dev'];
                    return allowedOrigins.includes(origin) ? origin : null;
                },
            })(c, next);
        } else {
            return cors({
                allowHeaders: ['Content-Type'],
                allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                maxAge: 600,
                credentials: true,
                origin: (origin) => {
                    const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
                    return allowedOrigins.includes(origin) ? origin : '*';
                },
            })(c, next);
        }
    };
}
