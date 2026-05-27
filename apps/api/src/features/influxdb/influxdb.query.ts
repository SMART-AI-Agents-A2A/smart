import { influxQueryApi } from './influxdb.connect';
import { influxRawObjectSchema, type InfluxRow } from './influxdb.vo';

export const queryFluxRows = async (fluxQuery: string): Promise<readonly InfluxRow[]> => {
    return new Promise<readonly InfluxRow[]>((resolve, reject) => {
        const rows: InfluxRow[] = [];
        let settled = false;

        const rejectOnce = (error: unknown): void => {
            if (settled) {
                return;
            }

            settled = true;
            reject(error instanceof Error ? error : new Error(String(error)));
        };

        influxQueryApi.queryRows(fluxQuery, {
            next(row, tableMeta): void {
                try {
                    const rawObject = tableMeta.toObject(row) as Record<string, unknown>;
                    rows.push(influxRawObjectSchema.parse(rawObject));
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
