import { InfluxDB, type QueryApi } from '@influxdata/influxdb-client';
import { z } from 'zod';
import { influxRawObjectSchema, type InfluxRow } from './influxdb.types';

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

export type InfluxRowParser<TRow extends InfluxRow> = (row: InfluxRow) => TRow;

export const queryFluxRows = async <TRow extends InfluxRow = InfluxRow>(
    fluxQuery: string,
    parser?: InfluxRowParser<TRow>,
): Promise<readonly TRow[]> => {
    return new Promise<readonly TRow[]>((resolve, reject) => {
        const rows: TRow[] = [];
        let settled = false;

        const rejectOnce = (error: unknown): void => {
            if (settled) {
                return;
            }

            settled = true;

            if (error instanceof Error) {
                reject(error);
                return;
            }

            reject(new Error(String(error)));
        };

        influxQueryApi.queryRows(fluxQuery, {
            next(row, tableMeta): void {
                try {
                    const rawObject = tableMeta.toObject(row) as Record<string, unknown>;
                    const parsedRow = influxRawObjectSchema.parse(rawObject);
                    const typedRow = parser ? parser(parsedRow) : (parsedRow as TRow);

                    rows.push(typedRow);
                } catch (error) {
                    rejectOnce(error);
                }
            },

            error(error): void {
                rejectOnce(error);
            },

            complete(): void {
                if (settled) {
                    return;
                }

                settled = true;
                resolve(rows);
            },
        });
    });
};
