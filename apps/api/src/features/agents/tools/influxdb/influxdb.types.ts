import { z } from 'zod';
import type { CacheMetadata } from '../cache';

export const sensorMeasurementSchema = z.enum(['Atmos41', 'Teros12', 'WXT520']);
export type SensorMeasurement = z.infer<typeof sensorMeasurementSchema>;

export const sensorGroupSchema = z.enum([
    'Ar',
    'Vento',
    'Chuva',
    'Radiação Solar',
    'Raios',
    'Umidade do Solo',
    'Temperatura do Solo',
    'Condutividade Elétrica',
]);
export type SensorGroupName = z.infer<typeof sensorGroupSchema>;

export const groupByColumnSchema = z.enum([
    'device_id',
    'unit',
    'block',
    'location',
    'plot',
    'experiment',
    'parameter',
]);
export type GroupByColumn = z.infer<typeof groupByColumnSchema>;

export const defaultFarmCode = 'Faz_NSAAB';

export const farmCodeSchema = z.literal(defaultFarmCode);
export type FarmCode = z.infer<typeof farmCodeSchema>;

export const defaultFarmScopeColumn = 'unit';

export const farmScopeColumnSchema = z.literal(defaultFarmScopeColumn);
export type FarmScopeColumn = z.infer<typeof farmScopeColumnSchema>;

export const fluxDurationSchema = z.string().regex(/^\d+(s|m|h|d|w|mo|y)$/, {
    message: 'Use uma duração Flux válida. Exemplos: 20m, 1h, 7d, 1mo, 1y.',
});

export const fluxTimeSchema = z
    .string()
    .min(1)
    .refine(
        (value) =>
            value === 'now()' ||
            /^-\d+(s|m|h|d|w|mo|y)$/.test(value) ||
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value),
        {
            message:
                'Use um tempo Flux válido. Exemplos: -6h, -7d, -1mo, now() ou 2026-04-30T00:00:00Z.',
        },
    );

export const sensorDataQuerySchema = z.object({
    farmCode: farmCodeSchema.default(defaultFarmCode),
    start: fluxTimeSchema,
    stop: fluxTimeSchema.optional(),
    every: fluxDurationSchema,
});
export type SensorDataQuery = z.infer<typeof sensorDataQuerySchema>;

export const sensorParamSchema = z.object({
    sensor: sensorMeasurementSchema,
});
export type SensorParam = z.infer<typeof sensorParamSchema>;

export const sensorGroupParamSchema = z.object({
    sensor: sensorMeasurementSchema,
    group: sensorGroupSchema,
});
export type SensorGroupParam = z.infer<typeof sensorGroupParamSchema>;

export type InfluxScalar = string | number | boolean | null;
export type InfluxRow = Record<string, InfluxScalar>;

export const influxRawObjectSchema = z
    .record(z.string(), z.unknown())
    .transform((input): InfluxRow => {
        const output: InfluxRow = {};

        for (const [key, value] of Object.entries(input)) {
            if (value === undefined) {
                continue;
            }

            if (
                typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean' ||
                value === null
            ) {
                output[key] = value;
                continue;
            }

            if (value instanceof Date) {
                output[key] = value.toISOString();
                continue;
            }

            output[key] = String(value);
        }

        return output;
    });

export interface SensorFieldUnit {
    readonly factor: number;
    readonly unit: string;
}

export interface SensorRange {
    readonly farmCode: FarmCode;
    readonly farmScopeColumn: FarmScopeColumn;
    readonly start: string;
    readonly stop: string;
    readonly every: string;
}

export interface SensorPoint {
    readonly time: string;
    readonly value: number;
    readonly rawValue: number;
    readonly unit: string;
}

export interface SensorSourceSeries {
    readonly sourceKey: string;
    readonly groupByColumn: GroupByColumn;
    readonly groupByValue: string;
    readonly deviceId: string | null;
    readonly unit: string | null;
    readonly block: string | null;
    readonly location: string | null;
    readonly plot: string | null;
    readonly experiment: string | null;
    readonly parameter: string | null;
    readonly points: readonly SensorPoint[];
}

export interface SensorFieldSeries {
    readonly field: string;
    readonly unit: string;
    readonly sources: readonly SensorSourceSeries[];
}

export interface SensorDataGroup {
    readonly name: string;
    readonly fields: readonly SensorFieldSeries[];
}

export interface SensorGroupedPayload {
    readonly sensor: SensorMeasurement;
    readonly range: SensorRange;
    readonly groupBy: GroupByColumn;
    readonly groups: readonly SensorDataGroup[];
}

export interface SensorGroupListPayload {
    readonly sensor: SensorMeasurement;
    readonly groups: readonly {
        readonly name: SensorGroupName;
        readonly fields: readonly string[];
    }[];
}

export interface ValidationIssue {
    readonly path: string;
    readonly message: string;
}

export interface ApiSuccessResponse<TData> {
    readonly requestId: string;
    readonly success: true;
    readonly data: TData;
}

export type WithCacheMetadata<TData> = TData & {
    readonly cache: CacheMetadata;
};

export interface ApiErrorResponse {
    readonly requestId: string;
    readonly success: false;
    readonly error: {
        readonly message: string;
        readonly issues?: readonly ValidationIssue[];
    };
}
