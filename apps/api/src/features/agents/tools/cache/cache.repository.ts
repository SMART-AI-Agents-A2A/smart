import { z } from 'zod';
import {
    cacheKeySchema,
    cacheStoredValueSchema,
    cacheTtlSecondsSchema,
    type CacheRepository,
    type CacheProvider,
    type CacheStoredValue,
} from './cache.types';

const cacheStoredJsonSchema = z.string().min(1);

const parseCacheJson = (key: string, value: string): unknown => {
    try {
        return JSON.parse(cacheStoredJsonSchema.parse(value));
    } catch (error) {
        throw new Error(`Snapshot de cache inválido para a chave "${key}".`, {
            cause: error,
        });
    }
};

export const createCacheRepository = (kv: KVNamespace): CacheRepository => {
    return {
        async get<TData>(
            key: string,
            schema: z.ZodType<TData>,
        ): Promise<CacheStoredValue<TData> | null> {
            const parsedKey = cacheKeySchema.parse(key);
            const stored = await kv.get(parsedKey);

            if (stored === null) {
                return null;
            }

            return cacheStoredValueSchema(schema).parse(parseCacheJson(parsedKey, stored));
        },

        async put<TData>(
            key: string,
            provider: CacheProvider,
            data: TData,
            ttlSeconds: number,
        ): Promise<CacheStoredValue<TData>> {
            const parsedKey = cacheKeySchema.parse(key);
            const parsedTtlSeconds = cacheTtlSecondsSchema.parse(ttlSeconds);
            const updatedAt = new Date();
            const stored: CacheStoredValue<TData> = {
                provider,
                data,
                updatedAt: updatedAt.toISOString(),
                expiresAt: new Date(updatedAt.getTime() + parsedTtlSeconds * 1000).toISOString(),
                ttlSeconds: parsedTtlSeconds,
            };

            await kv.put(parsedKey, JSON.stringify(stored));

            return stored;
        },

        async delete(key: string): Promise<void> {
            await kv.delete(cacheKeySchema.parse(key));
        },
    };
};
