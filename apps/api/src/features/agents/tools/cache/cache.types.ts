import { z } from 'zod';

export const cacheProviderSchema = z.enum(['openweather', 'influxdb', 'system']);

export const cacheSourceSchema = z.enum(['cache', 'origin', 'stale']);

export const cacheMetadataSchema = z.object({
    updatedAt: z.string().min(1),
    expiresAt: z.string().min(1),
    ttlSeconds: z.number().int().positive(),
    stale: z.boolean(),
    source: cacheSourceSchema,
});

export const cacheStoredValueSchema = <TDataSchema extends z.ZodType>(dataSchema: TDataSchema) =>
    z.object({
        provider: cacheProviderSchema,
        data: dataSchema,
        updatedAt: z.string().min(1),
        expiresAt: z.string().min(1),
        ttlSeconds: z.number().int().positive(),
    });

export const cacheSnapshotSchema = <TDataSchema extends z.ZodType>(dataSchema: TDataSchema) =>
    z.object({
        key: z.string().min(1),
        provider: cacheProviderSchema,
        data: dataSchema,
        cache: cacheMetadataSchema,
    });

export const cacheTtlSecondsSchema = z.number().int().positive();

export const cacheKeySchema = z.string().min(1);

export type CacheProvider = z.infer<typeof cacheProviderSchema>;

export type CacheSource = z.infer<typeof cacheSourceSchema>;

export type CacheMetadata = z.infer<typeof cacheMetadataSchema>;

export type CacheStoredValue<TData> = {
    readonly provider: CacheProvider;
    readonly data: TData;
    readonly updatedAt: string;
    readonly expiresAt: string;
    readonly ttlSeconds: number;
};

export type CacheSnapshot<TData> = {
    readonly key: string;
    readonly provider: CacheProvider;
    readonly data: TData;
    readonly cache: CacheMetadata;
};

export interface CacheLoadOptions<TData> {
    readonly key: string;
    readonly provider: CacheProvider;
    readonly ttlSeconds: number;
    readonly schema: z.ZodType<TData>;
    readonly load: () => Promise<TData>;
}

export interface CacheService {
    readonly get: <TData>(
        key: string,
        schema: z.ZodType<TData>,
    ) => Promise<CacheSnapshot<TData> | null>;
    readonly set: <TData>(
        key: string,
        provider: CacheProvider,
        data: TData,
        ttlSeconds: number,
        source?: CacheSource,
    ) => Promise<CacheSnapshot<TData>>;
    readonly getOrSet: <TData>(options: CacheLoadOptions<TData>) => Promise<CacheSnapshot<TData>>;
    readonly delete: (key: string) => Promise<void>;
}

export interface CacheRepository {
    readonly get: <TData>(
        key: string,
        schema: z.ZodType<TData>,
    ) => Promise<CacheStoredValue<TData> | null>;
    readonly put: <TData>(
        key: string,
        provider: CacheProvider,
        data: TData,
        ttlSeconds: number,
    ) => Promise<CacheStoredValue<TData>>;
    readonly delete: (key: string) => Promise<void>;
}
