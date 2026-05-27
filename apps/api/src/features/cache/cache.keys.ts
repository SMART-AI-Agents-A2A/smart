import { z } from 'zod';

const cacheKeyPrefix = 'smart:cache:v1';
const cacheKeyScopeSchema = z.enum(['health', 'lock', 'openweather', 'influxdb']);
const cacheKeySegmentSchema = z.union([z.string().min(1), z.number(), z.boolean()]);
const cacheKeyParamsSchema = z.record(
    z.string().min(1),
    z.union([cacheKeySegmentSchema, z.undefined()]),
);

export type CacheKeyScope = z.infer<typeof cacheKeyScopeSchema>;
export type CacheKeyParams = z.infer<typeof cacheKeyParamsSchema>;

const encodeCacheKeyPart = (value: string | number | boolean): string => {
    return encodeURIComponent(String(value));
};

const toStableQuery = (params: CacheKeyParams): string => {
    const parsed = cacheKeyParamsSchema.parse(params);

    return Object.entries(parsed)
        .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${encodeCacheKeyPart(key)}=${encodeCacheKeyPart(value)}`)
        .join('&');
};

export const buildCacheKey = (
    scope: CacheKeyScope,
    segments: readonly (string | number | boolean)[],
    params: CacheKeyParams = {},
): string => {
    const parsedScope = cacheKeyScopeSchema.parse(scope);
    const parsedSegments = z.array(cacheKeySegmentSchema).parse(segments);
    const path = [cacheKeyPrefix, parsedScope, ...parsedSegments.map(encodeCacheKeyPart)].join(':');
    const query = toStableQuery(params);

    return query ? `${path}?${query}` : path;
};

export const buildCacheHealthcheckKey = (): string => {
    return buildCacheKey('health', ['healthcheck']);
};

export const buildCacheLockKey = (name: string): string => {
    return buildCacheKey('lock', [name]);
};
