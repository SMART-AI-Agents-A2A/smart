import { z } from 'zod';
import { parseCacheBindings } from './cache.bindings';
import { createCacheRepository } from './cache.repository';
import {
    cacheSnapshotSchema,
    type CacheLoadOptions,
    type CacheProvider,
    type CacheRepository,
    type CacheService,
    type CacheSnapshot,
    type CacheSource,
    type CacheStoredValue,
} from './cache.vo';

const isFresh = (stored: CacheStoredValue<unknown>): boolean => {
    return Date.parse(stored.expiresAt) > Date.now();
};

const toSnapshot = <TData>(
    key: string,
    stored: CacheStoredValue<TData>,
    source: CacheSource,
): CacheSnapshot<TData> => {
    return {
        key,
        provider: stored.provider,
        data: stored.data,
        cache: {
            updatedAt: stored.updatedAt,
            expiresAt: stored.expiresAt,
            ttlSeconds: stored.ttlSeconds,
            stale: source === 'stale',
            source,
        },
    };
};

export const createCacheServiceFromRepository = (repository: CacheRepository): CacheService => {
    return {
        async get<TData>(
            key: string,
            schema: z.ZodType<TData>,
        ): Promise<CacheSnapshot<TData> | null> {
            const stored = await repository.get(key, schema);

            if (stored === null) {
                return null;
            }

            const source = isFresh(stored) ? 'cache' : 'stale';

            return cacheSnapshotSchema(schema).parse(toSnapshot(key, stored, source));
        },

        async set<TData>(
            key: string,
            provider: CacheProvider,
            data: TData,
            ttlSeconds: number,
            source: CacheSource = 'origin',
        ): Promise<CacheSnapshot<TData>> {
            const stored = await repository.put(key, provider, data, ttlSeconds);
            const snapshot = toSnapshot(key, stored, source);

            cacheSnapshotSchema(z.unknown()).parse(snapshot);

            return snapshot;
        },

        async getOrSet<TData>(options: CacheLoadOptions<TData>): Promise<CacheSnapshot<TData>> {
            const cached = await repository.get(options.key, options.schema);

            if (cached && isFresh(cached)) {
                return cacheSnapshotSchema(options.schema).parse(
                    toSnapshot(options.key, cached, 'cache'),
                );
            }

            try {
                const data = options.schema.parse(await options.load());
                const stored = await repository.put(
                    options.key,
                    options.provider,
                    data,
                    options.ttlSeconds,
                );

                return cacheSnapshotSchema(options.schema).parse(
                    toSnapshot(options.key, stored, 'origin'),
                );
            } catch (error) {
                if (cached) {
                    console.warn(`Usando snapshot stale para "${options.key}".`, error);

                    return cacheSnapshotSchema(options.schema).parse(
                        toSnapshot(options.key, cached, 'stale'),
                    );
                }
                throw error;
            }
        },

        async delete(key: string): Promise<void> {
            await repository.delete(key);
        },

        async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
            return repository.acquireLock(key, ttlSeconds);
        },

        async releaseLock(key: string): Promise<void> {
            await repository.releaseLock(key);
        },
    };
};

export const createCacheService = (env: unknown): CacheService => {
    const { smart_cache } = parseCacheBindings(env);

    return createCacheServiceFromRepository(createCacheRepository(smart_cache));
};
