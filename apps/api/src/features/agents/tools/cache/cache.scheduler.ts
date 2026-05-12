import { z } from 'zod';
import { getOpenWeatherFarmLocation } from '../openweather/openweather.geojson';
import {
    getCachedCurrentWeather,
    getCachedForecastWeather,
    getCachedSummaryWeather,
} from '../openweather/openweather.cache';
import { openWeatherQuerySchema } from '../openweather/openweather.types';
import { buildCacheKey, buildCacheLockKey } from './cache.keys';
import { createCacheService } from './cache.service';
import { cacheDefaultTtlSeconds } from './cache.types';

const cacheSchedulerLockTtlSeconds = 240;
const schedulerStatusKey = buildCacheKey('health', ['scheduler', 'last-refresh']);
const schedulerLockKey = buildCacheLockKey('scheduler-refresh');
const defaultOpenWeatherQuery = openWeatherQuerySchema.parse({
    units: 'metric',
    lang: 'pt_br',
});
const openWeatherTargets = [
    'openweather:farm:current',
    'openweather:farm:forecast',
    'openweather:farm:summary',
] as const;

export const cacheSchedulerTriggerSchema = z.enum(['startup', 'scheduled', 'manual']);

export const cacheSchedulerStatusSchema = z.object({
    trigger: cacheSchedulerTriggerSchema,
    refreshedAt: z.string().min(1),
    targets: z.array(z.string().min(1)),
});

export const cacheSchedulerResultSchema = z.object({
    ok: z.boolean(),
    skipped: z.boolean(),
    trigger: cacheSchedulerTriggerSchema,
    refreshedAt: z.string().min(1).optional(),
    targets: z.array(z.string().min(1)),
});

export type CacheSchedulerTrigger = z.infer<typeof cacheSchedulerTriggerSchema>;

export type CacheSchedulerStatus = z.infer<typeof cacheSchedulerStatusSchema>;

export type CacheSchedulerResult = z.infer<typeof cacheSchedulerResultSchema>;

export interface RefreshAllOptions {
    readonly trigger?: CacheSchedulerTrigger;
}

export const refreshAll = async (
    env: unknown,
    options: RefreshAllOptions = {},
): Promise<CacheSchedulerResult> => {
    const trigger = cacheSchedulerTriggerSchema.parse(options.trigger ?? 'manual');
    const cache = createCacheService(env);
    const acquired = await cache.acquireLock(schedulerLockKey, cacheSchedulerLockTtlSeconds);
    const targets = ['system:scheduler-status', ...openWeatherTargets];

    if (!acquired) {
        console.info(`Cache refresh skipped for trigger "${trigger}": job already running.`);

        return cacheSchedulerResultSchema.parse({
            ok: true,
            skipped: true,
            trigger,
            targets,
        });
    }

    try {
        const refreshedAt = new Date().toISOString();
        const status: CacheSchedulerStatus = {
            trigger,
            refreshedAt,
            targets,
        };

        console.info(`Cache refresh started for trigger "${trigger}".`);

        await refreshOpenWeatherTargets(env);

        await cache.set(
            schedulerStatusKey,
            'system',
            cacheSchedulerStatusSchema.parse(status),
            cacheDefaultTtlSeconds,
        );

        console.info(`Cache refresh finished for trigger "${trigger}".`);

        return cacheSchedulerResultSchema.parse({
            ok: true,
            skipped: false,
            trigger,
            refreshedAt,
            targets,
        });
    } catch (error) {
        console.error(`Cache refresh failed for trigger "${trigger}".`, error);

        throw error;
    } finally {
        await cache.releaseLock(schedulerLockKey);
    }
};

const refreshOpenWeatherTargets = async (env: unknown): Promise<void> => {
    const farm = getOpenWeatherFarmLocation();

    await Promise.all([
        getCachedCurrentWeather(env, farm, defaultOpenWeatherQuery),
        getCachedForecastWeather(env, farm, defaultOpenWeatherQuery),
        getCachedSummaryWeather(env, farm, defaultOpenWeatherQuery),
    ]);
};
