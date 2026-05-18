import { z } from 'zod';
import { parseCacheBindings } from './cache.bindings';
import { buildCacheHealthcheckKey } from './cache.keys';
import { createCacheService } from './cache.service';

const cacheHealthcheckTtlSeconds = 60;

const cacheHealthcheckPayloadSchema = z.object({
    writtenAt: z.string().min(1),
});

export const cacheHealthcheckResultSchema = z.object({
    ok: z.boolean(),
    key: z.string().min(1),
    writtenAt: z.string().min(1),
});

export type CacheHealthcheckResult = z.infer<typeof cacheHealthcheckResultSchema>;

export const checkCacheKv = async (env: unknown): Promise<CacheHealthcheckResult> => {
    parseCacheBindings(env);

    const cache = createCacheService(env);
    const key = buildCacheHealthcheckKey();
    const writtenAt = new Date().toISOString();
    await cache.set(key, 'system', { writtenAt }, cacheHealthcheckTtlSeconds);

    const snapshot = await cache.get(key, cacheHealthcheckPayloadSchema);

    return cacheHealthcheckResultSchema.parse({
        ok: snapshot?.data.writtenAt === writtenAt,
        key,
        writtenAt,
    });
};
