import { z } from 'zod';
import { buildCacheKey } from '../cache';
import {
    openWeatherCurrentResponseSchema,
    openWeatherForecastResponseSchema,
    openWeatherQuerySchema,
} from './openweather.types';

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
