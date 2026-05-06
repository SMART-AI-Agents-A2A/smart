import { getDefaultBucket, queryFluxRows } from './influxdb.connect';
import type { InfluxRow, SensorMeasurement, SensorQuery, SensorRange } from './influxdb.types';

interface BuildSensorFluxQueryInput {
    readonly bucket?: string;
    readonly measurement: SensorMeasurement;
    readonly start: string;
    readonly stop?: string;
    readonly every?: string;
}

interface BuildMeasurementsFluxQueryInput {
    readonly bucket?: string;
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
            `Duração Flux inválida: ${value}. Use exemplos como 10m, 1h, 1d, 1mo ou 1y.`,
        );
    }

    return value;
};

export const buildMeasurementsFluxQuery = (input: BuildMeasurementsFluxQueryInput = {}): string => {
    const bucket = input.bucket ?? getDefaultBucket();

    return `
import "influxdata/influxdb/schema"

schema.measurements(bucket: ${quoteFluxString(bucket)})
`.trim();
};

export const buildSensorFluxQuery = (input: BuildSensorFluxQueryInput): string => {
    const bucket = input.bucket ?? getDefaultBucket();
    const start = toFluxTimeLiteral(input.start);
    const stop = input.stop ? toFluxTimeLiteral(input.stop) : 'now()';

    const queryLines: string[] = [
        `from(bucket: ${quoteFluxString(bucket)})`,
        `  |> range(start: ${start}, stop: ${stop})`,
        `  |> filter(fn: (r) => r["_measurement"] == ${quoteFluxString(input.measurement)})`,
    ];

    if (input.every) {
        queryLines.push(
            `  |> aggregateWindow(every: ${toFluxDurationLiteral(input.every)}, fn: mean, createEmpty: false)`,
        );
    }

    queryLines.push(
        `  |> drop(columns: ["_start", "_stop"])`,
        `  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")`,
        `  |> sort(columns: ["_time"])`,
    );

    return queryLines.join('\n');
};

export const buildSensorRange = (query: SensorQuery): SensorRange => {
    return {
        start: query.start,
        stop: query.stop ?? 'now()',
        every: query.every ?? null,
    };
};

export const getMeasurements = async (bucket?: string): Promise<readonly string[]> => {
    const fluxQuery = buildMeasurementsFluxQuery({ bucket });
    const rows = await queryFluxRows(fluxQuery);

    return rows
        .map((row) => row['_value'])
        .filter((value): value is string => typeof value === 'string')
        .sort((left, right) => left.localeCompare(right));
};

export const getSensorRows = async (
    measurement: SensorMeasurement,
    query: SensorQuery,
): Promise<readonly InfluxRow[]> => {
    const fluxQuery = buildSensorFluxQuery({
        bucket: query.bucket,
        measurement,
        start: query.start,
        stop: query.stop,
        every: query.every,
    });

    const rows = await queryFluxRows(fluxQuery);

    return rows.map(removeInternalInfluxColumns).sort(sortRowsByTime);
};

export const rowsToCsv = <TRow extends InfluxRow>(rows: readonly TRow[]): string => {
    const headers = Array.from(
        rows.reduce<Set<string>>((accumulator, row) => {
            Object.keys(row).forEach((key) => accumulator.add(key));

            return accumulator;
        }, new Set<string>()),
    );

    if (headers.length === 0) {
        return '';
    }

    const lines = [
        headers.join(','),
        ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
    ];

    return lines.join('\n');
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
    const leftTime = getStringColumn(left, '_time') ?? '';
    const rightTime = getStringColumn(right, '_time') ?? '';

    return leftTime.localeCompare(rightTime);
};

const getStringColumn = (row: InfluxRow, column: string): string | null => {
    const value = row[column];

    if (typeof value === 'string') {
        return value;
    }

    return null;
};

const escapeCsvValue = (value: InfluxRow[string] | undefined): string => {
    if (value === null || value === undefined) {
        return '';
    }

    const text = String(value);

    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
};
