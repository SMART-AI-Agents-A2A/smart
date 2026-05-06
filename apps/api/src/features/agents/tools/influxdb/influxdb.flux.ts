import { getDefaultBucket } from './influxdb.connect';
import { queryFluxRows } from './influxdb.query';
import type { InfluxRow, SensorDataQuery, SensorMeasurement, SensorRange } from './influxdb.types';

interface BuildSensorFluxQueryInput {
    readonly measurement: SensorMeasurement;
    readonly start: string;
    readonly stop?: string;
    readonly every: string;
}

const relativeTimeRegex = /^-\d+(s|m|h|d|w|mo|y)$/;
const durationRegex = /^\d+(s|m|h|d|w|mo|y)$/;
const isoUtcTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const quoteFluxString = (value: string): string => {
    const escaped = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

    return `"${escaped}"`;
};

const toFluxTimeLiteral = (value: string): string => {
    if (value === 'now()') {
        return 'now()';
    }

    if (relativeTimeRegex.test(value)) {
        return value;
    }

    if (isoUtcTimeRegex.test(value) && !Number.isNaN(Date.parse(value))) {
        return value;
    }

    throw new Error(
        `Tempo Flux inválido: ${value}. Use -6h, -7d, -1mo, now() ou ISO UTC como 2026-04-30T00:00:00Z.`,
    );
};

const toFluxDurationLiteral = (value: string): string => {
    if (!durationRegex.test(value)) {
        throw new Error(
            `Duração Flux inválida: ${value}. Use exemplos como 20m, 1h, 1d, 1mo ou 1y.`,
        );
    }

    return value;
};

export const buildMeasurementsFluxQuery = (): string => {
    return `
import "influxdata/influxdb/schema"

schema.measurements(bucket: ${quoteFluxString(getDefaultBucket())})
`.trim();
};

export const buildSensorFluxQuery = (input: BuildSensorFluxQueryInput): string => {
    const start = toFluxTimeLiteral(input.start);
    const stop = input.stop ? toFluxTimeLiteral(input.stop) : 'now()';
    const every = toFluxDurationLiteral(input.every);

    return [
        `from(bucket: ${quoteFluxString(getDefaultBucket())})`,
        `  |> range(start: ${start}, stop: ${stop})`,
        `  |> filter(fn: (r) => r["_measurement"] == ${quoteFluxString(input.measurement)})`,
        `  |> aggregateWindow(every: ${every}, fn: mean, createEmpty: false)`,
        `  |> drop(columns: ["_start", "_stop"])`,
        `  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")`,
        `  |> sort(columns: ["_time"])`,
    ].join('\n');
};

export const buildSensorRange = (query: SensorDataQuery): SensorRange => {
    return {
        start: query.start,
        stop: query.stop ?? 'now()',
        every: query.every,
    };
};

export const getMeasurements = async (): Promise<readonly string[]> => {
    const rows = await queryFluxRows(buildMeasurementsFluxQuery());

    return rows
        .map((row) => row['_value'])
        .filter((value): value is string => typeof value === 'string')
        .sort((left, right) => left.localeCompare(right));
};

export const getSensorRows = async (
    measurement: SensorMeasurement,
    query: SensorDataQuery,
): Promise<readonly InfluxRow[]> => {
    const rows = await queryFluxRows(
        buildSensorFluxQuery({
            measurement,
            start: query.start,
            stop: query.stop,
            every: query.every,
        }),
    );

    return rows.map(removeInternalInfluxColumns).sort(sortRowsByTime);
};

const removeInternalInfluxColumns = (row: InfluxRow): InfluxRow => {
    const internalColumns = new Set(['result', 'table']);
    const output: InfluxRow = {};

    for (const [key, value] of Object.entries(row)) {
        if (!internalColumns.has(key)) {
            output[key] = value;
        }
    }

    return output;
};

const sortRowsByTime = (left: InfluxRow, right: InfluxRow): number => {
    const leftTime = typeof left['_time'] === 'string' ? left['_time'] : '';
    const rightTime = typeof right['_time'] === 'string' ? right['_time'] : '';

    return leftTime.localeCompare(rightTime);
};
