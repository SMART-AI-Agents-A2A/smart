import { Hono } from 'hono';
import { openAPIRouteHandler } from 'hono-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { TagsEnum } from './openapi.tags';

export function mountOpenApi(app: Hono<{ Bindings: CloudflareBindings }>) {
    app.get(
        '/openapi',
        openAPIRouteHandler(app, {
            documentation: {
                openapi: '3.1.0',
                info: {
                    title: 'Smart API',
                    version: '0.1.0',
                    description: 'Documentação da Smart API',
                },
                servers: [
                    {
                        url: 'http://127.0.0.1:8787',
                        description: 'Local Server',
                    },
                ],
                tags: [
                    {
                        name: TagsEnum.stats,
                        description: 'System health monitoring and API status information.',
                    },
                    {
                        name: TagsEnum.auth,
                        description: 'Authentication and authorization endpoints.',
                    },
                    {
                        name: TagsEnum.user,
                        description: 'User management endpoints.',
                    },
                ],
            },
        }),
    );

    app.get(
        '/scalar',
        Scalar({
            theme: 'deepSpace',
            hideDownloadButton: false,
            hideClientButton: true,
            layout: 'modern',
            url: '/openapi',
        }),
    );
}
