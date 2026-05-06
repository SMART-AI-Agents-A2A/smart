import { z } from 'zod';

export const sensorMeasurementSchema = z.enum(['Atmos41', 'Teros12', 'WXT520']);

export type SensorMeasurement = z.infer<typeof sensorMeasurementSchema>;

export const outputFormatSchema = z.enum(['json', 'csv']);

export type OutputFormat = z.infer<typeof outputFormatSchema>;

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

export const fluxDurationSchema = z.string().regex(/^\d+(s|m|h|d|w|mo|y)$/, {
    message: 'Use uma duração Flux válida. Exemplos: 10m, 1h, 7d, 1mo, 1y.',
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

export const sensorQuerySchema = z.object({
    bucket: z.string().min(1).optional(),

    start: fluxTimeSchema,

    stop: fluxTimeSchema.optional(),

    every: fluxDurationSchema.optional(),

    format: outputFormatSchema.default('json'),

    groupedBy: groupByColumnSchema.optional(),
});

export type SensorQuery = z.infer<typeof sensorQuerySchema>;

export const measurementsQuerySchema = z.object({
    bucket: z.string().min(1).optional(),
});

export type MeasurementsQuery = z.infer<typeof measurementsQuerySchema>;

export const sensorParamSchema = z.object({
    sensor: sensorMeasurementSchema,
});

export type SensorParam = z.infer<typeof sensorParamSchema>;

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
    readonly start: string;
    readonly stop: string;
    readonly every: string | null;
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

export interface SensorRowsPayload {
    readonly sensor: SensorMeasurement;
    readonly range: SensorRange;
    readonly rows: readonly InfluxRow[];
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

export interface ApiErrorResponse {
    readonly requestId: string;
    readonly success: false;
    readonly error: {
        readonly message: string;
        readonly issues?: readonly ValidationIssue[];
    };
}
