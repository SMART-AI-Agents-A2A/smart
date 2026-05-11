import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { checkCacheKv } from './cache.health';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.get('/health', async (c) => {
    return c.json(await checkCacheKv(c.env), StatusCodes.OK);
});

export { router as cacheRoutes };
