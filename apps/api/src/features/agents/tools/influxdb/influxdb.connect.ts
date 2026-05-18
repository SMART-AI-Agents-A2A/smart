import { InfluxDB, type QueryApi } from '@influxdata/influxdb-client';
import { z } from 'zod';

const envSchema = z.object({
    INFLUXDB_URL: z.string().url(),
    INFLUXDB_TOKEN: z.string().min(1),
    INFLUXDB_ORG: z.string().min(1),
    INFLUXDB_BUCKET: z.string().min(1),
});

export const influxEnv = envSchema.parse(process.env);

export const influxdb = new InfluxDB({
    url: influxEnv.INFLUXDB_URL,
    token: influxEnv.INFLUXDB_TOKEN,
});

export const influxQueryApi: QueryApi = influxdb.getQueryApi(influxEnv.INFLUXDB_ORG);

export const getDefaultBucket = (): string => {
    return influxEnv.INFLUXDB_BUCKET;
};
