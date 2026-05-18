import { parseCacheBindings } from './cache.bindings';

const cacheHealthcheckKey = 'cache:healthcheck';
const cacheHealthcheckTtlSeconds = 60;

export interface CacheHealthcheckResult {
    readonly ok: boolean;
    readonly key: string;
    readonly writtenAt: string;
}

export const checkCacheKv = async (env: unknown): Promise<CacheHealthcheckResult> => {
    const { smart_cache } = parseCacheBindings(env);
    const writtenAt = new Date().toISOString();

    await smart_cache.put(cacheHealthcheckKey, writtenAt, {
        expirationTtl: cacheHealthcheckTtlSeconds,
    });

    const stored = await smart_cache.get(cacheHealthcheckKey);

    return {
        ok: stored === writtenAt,
        key: cacheHealthcheckKey,
        writtenAt,
    };
};
