import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { checkCacheKv } from './cache.health';
import { getCacheSchedulerStatus } from './cache.scheduler';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.get('/health', async (c) => {
    return c.json(await checkCacheKv(c.env), StatusCodes.OK);
});

router.get('/scheduler', async (c) => {
    const status = await getCacheSchedulerStatus(c.env);

    return c.json(
        {
            ok: status !== null,
            status,
        },
        StatusCodes.OK,
    );
});

export { router as cacheRoutes };
