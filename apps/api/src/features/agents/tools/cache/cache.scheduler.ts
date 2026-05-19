import { z } from 'zod';
import { getCachedMeasurements, getCachedSensorGroupData } from '../influxdb/influxdb.cache';
import { defaultFarmCode, sensorDataQuerySchema } from '../influxdb/influxdb.types';
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
const defaultSensorDataQuery = sensorDataQuerySchema.parse({
    farmCode: defaultFarmCode,
    start: '-6h',
    every: '20m',
});
const influxTargets = [
    'influxdb:measurements',
    'influxdb:sensors:Atmos41:groups:Ar:data',
    'influxdb:sensors:Atmos41:groups:Vento:data',
    'influxdb:sensors:Atmos41:groups:Chuva:data',
    'influxdb:sensors:Atmos41:groups:Radiação Solar:data',
    'influxdb:sensors:Teros12:groups:Umidade do Solo:data',
    'influxdb:sensors:Teros12:groups:Temperatura do Solo:data',
    'influxdb:sensors:Teros12:groups:Condutividade Elétrica:data',
] as const;

export const cacheSchedulerTriggerSchema = z.enum(['startup', 'scheduled', 'manual']);

export const cacheSchedulerStatusSchema = z.object({
    trigger: cacheSchedulerTriggerSchema,
    refreshedAt: z.string().min(1),
    targets: z.array(z.string().min(1)),
    failedTargets: z.array(z.string().min(1)),
});

export const cacheSchedulerResultSchema = z.object({
    ok: z.boolean(),
    skipped: z.boolean(),
    trigger: cacheSchedulerTriggerSchema,
    refreshedAt: z.string().min(1).optional(),
    targets: z.array(z.string().min(1)),
    failedTargets: z.array(z.string().min(1)),
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
    const targets = ['system:scheduler-status', ...openWeatherTargets, ...influxTargets];

    if (!acquired) {
        console.info(`Cache refresh skipped for trigger "${trigger}": job already running.`);

        return cacheSchedulerResultSchema.parse({
            ok: true,
            skipped: true,
            trigger,
            targets,
            failedTargets: [],
        });
    }

    try {
        const refreshedAt = new Date().toISOString();
        const failedTargets = await refreshEnvironmentalTargets(env);
        const status: CacheSchedulerStatus = {
            trigger,
            refreshedAt,
            targets,
            failedTargets,
        };

        console.info(`Cache refresh started for trigger "${trigger}".`);

        await cache.set(
            schedulerStatusKey,
            'system',
            cacheSchedulerStatusSchema.parse(status),
            cacheDefaultTtlSeconds,
        );

        console.info(`Cache refresh finished for trigger "${trigger}".`);

        return cacheSchedulerResultSchema.parse({
            ok: failedTargets.length === 0,
            skipped: false,
            trigger,
            refreshedAt,
            targets,
            failedTargets,
        });
    } catch (error) {
        console.error(`Cache refresh failed for trigger "${trigger}".`, error);

        throw error;
    } finally {
        await cache.releaseLock(schedulerLockKey);
    }
};

const refreshEnvironmentalTargets = async (env: unknown): Promise<string[]> => {
    const farm = getOpenWeatherFarmLocation();
    const targetLoaders: readonly {
        readonly name: string;
        readonly load: () => Promise<unknown>;
    }[] = [
        {
            name: 'openweather:farm:current',
            load: () => getCachedCurrentWeather(env, farm, defaultOpenWeatherQuery),
        },
        {
            name: 'openweather:farm:forecast',
            load: () => getCachedForecastWeather(env, farm, defaultOpenWeatherQuery),
        },
        {
            name: 'openweather:farm:summary',
            load: () => getCachedSummaryWeather(env, farm, defaultOpenWeatherQuery),
        },
        {
            name: 'influxdb:measurements',
            load: () => getCachedMeasurements(env),
        },
        {
            name: 'influxdb:sensors:Atmos41:groups:Ar:data',
            load: () => getCachedSensorGroupData(env, 'Atmos41', 'Ar', defaultSensorDataQuery),
        },
        {
            name: 'influxdb:sensors:Atmos41:groups:Vento:data',
            load: () => getCachedSensorGroupData(env, 'Atmos41', 'Vento', defaultSensorDataQuery),
        },
        {
            name: 'influxdb:sensors:Atmos41:groups:Chuva:data',
            load: () => getCachedSensorGroupData(env, 'Atmos41', 'Chuva', defaultSensorDataQuery),
        },
        {
            name: 'influxdb:sensors:Atmos41:groups:Radiação Solar:data',
            load: () =>
                getCachedSensorGroupData(env, 'Atmos41', 'Radiação Solar', defaultSensorDataQuery),
        },
        {
            name: 'influxdb:sensors:Teros12:groups:Umidade do Solo:data',
            load: () =>
                getCachedSensorGroupData(env, 'Teros12', 'Umidade do Solo', defaultSensorDataQuery),
        },
        {
            name: 'influxdb:sensors:Teros12:groups:Temperatura do Solo:data',
            load: () =>
                getCachedSensorGroupData(
                    env,
                    'Teros12',
                    'Temperatura do Solo',
                    defaultSensorDataQuery,
                ),
        },
        {
            name: 'influxdb:sensors:Teros12:groups:Condutividade Elétrica:data',
            load: () =>
                getCachedSensorGroupData(
                    env,
                    'Teros12',
                    'Condutividade Elétrica',
                    defaultSensorDataQuery,
                ),
        },
    ];

    const results = await Promise.allSettled(
        targetLoaders.map(async (target) => {
            await target.load();

            return target.name;
        }),
    );

    return results.flatMap((result, index) => {
        if (result.status === 'fulfilled') {
            return [];
        }

        const target = targetLoaders[index];

        console.warn(`Cache refresh target failed: ${target.name}.`, result.reason);

        return [target.name];
    });
};
