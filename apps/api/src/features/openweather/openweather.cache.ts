import { z } from 'zod';
import {
    buildCacheKey,
    cacheDefaultTtlSeconds,
    createCacheService,
    type CacheSnapshot,
} from '../cache';
import { getCurrentWeather, getForecastWeather } from './openweather.connect';
import {
    openWeatherCurrentResponseSchema,
    openWeatherForecastResponseSchema,
    openWeatherQuerySchema,
    type OpenWeatherCurrentResponse,
    type OpenWeatherFarmLocation,
    type OpenWeatherForecastResponse,
    type OpenWeatherQuery,
} from './openweather.vo';

const openWeatherCacheTypeSchema = z.enum(['current', 'forecast', 'summary']);

const openWeatherCacheQueryParamsSchema = openWeatherQuerySchema.transform((query) => ({
    units: query.units,
    lang: query.lang,
    cnt: query.cnt,
}));

export const openWeatherSummaryCachePayloadSchema = z.object({
    current: openWeatherCurrentResponseSchema,
    forecast: openWeatherForecastResponseSchema,
});

export type OpenWeatherCacheType = z.infer<typeof openWeatherCacheTypeSchema>;

export type OpenWeatherSummaryCachePayload = z.infer<typeof openWeatherSummaryCachePayloadSchema>;

export const buildOpenWeatherFarmCacheKey = (
    type: OpenWeatherCacheType,
    rawQuery: unknown,
): string => {
    const parsedType = openWeatherCacheTypeSchema.parse(type);
    const query = openWeatherCacheQueryParamsSchema.parse(rawQuery);

    return buildCacheKey('openweather', ['farm', parsedType], query);
};

export const getCachedCurrentWeather = async (
    env: unknown,
    farm: OpenWeatherFarmLocation,
    query: OpenWeatherQuery,
): Promise<CacheSnapshot<OpenWeatherCurrentResponse>> => {
    const cache = createCacheService(env);

    return cache.getOrSet({
        key: buildOpenWeatherFarmCacheKey('current', query),
        provider: 'openweather',
        ttlSeconds: cacheDefaultTtlSeconds,
        schema: openWeatherCurrentResponseSchema,
        load: () => getCurrentWeather(env, farm, query),
    });
};

export const getCachedForecastWeather = async (
    env: unknown,
    farm: OpenWeatherFarmLocation,
    query: OpenWeatherQuery,
): Promise<CacheSnapshot<OpenWeatherForecastResponse>> => {
    const cache = createCacheService(env);

    return cache.getOrSet({
        key: buildOpenWeatherFarmCacheKey('forecast', query),
        provider: 'openweather',
        ttlSeconds: cacheDefaultTtlSeconds,
        schema: openWeatherForecastResponseSchema,
        load: () => getForecastWeather(env, farm, query),
    });
};

export const getCachedSummaryWeather = async (
    env: unknown,
    farm: OpenWeatherFarmLocation,
    query: OpenWeatherQuery,
): Promise<CacheSnapshot<OpenWeatherSummaryCachePayload>> => {
    const cache = createCacheService(env);

    return cache.getOrSet({
        key: buildOpenWeatherFarmCacheKey('summary', query),
        provider: 'openweather',
        ttlSeconds: cacheDefaultTtlSeconds,
        schema: openWeatherSummaryCachePayloadSchema,
        load: async () => {
            const [current, forecast] = await Promise.all([
                getCurrentWeather(env, farm, query),
                getForecastWeather(env, farm, query),
            ]);

            return {
                current,
                forecast,
            };
        },
    });
};
