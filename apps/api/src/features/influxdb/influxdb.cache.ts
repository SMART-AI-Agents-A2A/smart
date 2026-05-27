import { z } from 'zod';
import {
    buildCacheKey,
    cacheDefaultTtlSeconds,
    createCacheService,
    type CacheSnapshot,
} from '../cache';
import { getMeasurements, getSensorRows } from './influxdb.flux';
import { groupSensorRows } from './influxdb.groups';
import {
    defaultFarmCode,
    defaultFarmScopeColumn,
    farmCodeSchema,
    farmScopeColumnSchema,
    groupByColumnSchema,
    sensorDataQuerySchema,
    sensorGroupSchema,
    sensorMeasurementSchema,
    type SensorDataQuery,
    type SensorGroupedPayload,
    type SensorGroupName,
    type SensorMeasurement,
} from './influxdb.vo';

export const influxMeasurementsCachePayloadSchema = z.array(z.string());

export const sensorRangeCacheSchema = z.object({
    farmCode: farmCodeSchema.default(defaultFarmCode),
    farmScopeColumn: farmScopeColumnSchema.default(defaultFarmScopeColumn),
    start: z.string().min(1),
    stop: z.string().min(1),
    every: z.string().min(1),
});

export const sensorPointCacheSchema = z.object({
    time: z.string().min(1),
    value: z.number(),
    rawValue: z.number(),
    unit: z.string(),
});

export const sensorSourceSeriesCacheSchema = z.object({
    sourceKey: z.string().min(1),
    groupByColumn: groupByColumnSchema,
    groupByValue: z.string().min(1),
    deviceId: z.string().nullable(),
    unit: z.string().nullable(),
    block: z.string().nullable(),
    location: z.string().nullable(),
    plot: z.string().nullable(),
    experiment: z.string().nullable(),
    parameter: z.string().nullable(),
    points: z.array(sensorPointCacheSchema),
});

export const sensorFieldSeriesCacheSchema = z.object({
    field: z.string().min(1),
    unit: z.string(),
    sources: z.array(sensorSourceSeriesCacheSchema),
});

export const sensorDataGroupCacheSchema = z.object({
    name: z.string().min(1),
    fields: z.array(sensorFieldSeriesCacheSchema),
});

export const sensorGroupedCachePayloadSchema = z.object({
    sensor: sensorMeasurementSchema,
    range: sensorRangeCacheSchema,
    groupBy: groupByColumnSchema,
    groups: z.array(sensorDataGroupCacheSchema),
});

export const buildInfluxMeasurementsCacheKey = (): string => {
    return buildCacheKey('influxdb', ['measurements']);
};

export const buildInfluxSensorGroupDataCacheKey = (
    sensor: SensorMeasurement,
    group: SensorGroupName,
    query: SensorDataQuery,
): string => {
    const parsedSensor = sensorMeasurementSchema.parse(sensor);
    const parsedGroup = sensorGroupSchema.parse(group);
    const parsedQuery = sensorDataQuerySchema.parse(query);

    return buildCacheKey('influxdb', ['sensors', parsedSensor, 'groups', parsedGroup, 'data'], {
        farmCode: parsedQuery.farmCode,
        start: parsedQuery.start,
        stop: parsedQuery.stop,
        every: parsedQuery.every,
    });
};

export const getCachedMeasurements = async (
    env: unknown,
): Promise<CacheSnapshot<readonly string[]>> => {
    const cache = createCacheService(env);

    return cache.getOrSet({
        key: buildInfluxMeasurementsCacheKey(),
        provider: 'influxdb',
        ttlSeconds: cacheDefaultTtlSeconds,
        schema: influxMeasurementsCachePayloadSchema,
        load: getMeasurements,
    });
};

export const getCachedSensorGroupData = async (
    env: unknown,
    sensor: SensorMeasurement,
    group: SensorGroupName,
    query: SensorDataQuery,
): Promise<CacheSnapshot<SensorGroupedPayload>> => {
    const cache = createCacheService(env);

    return cache.getOrSet({
        key: buildInfluxSensorGroupDataCacheKey(sensor, group, query),
        provider: 'influxdb',
        ttlSeconds: cacheDefaultTtlSeconds,
        schema: sensorGroupedCachePayloadSchema,
        load: async () => {
            const rows = await getSensorRows(sensor, query);

            return groupSensorRows(sensor, group, rows, query);
        },
    });
};
