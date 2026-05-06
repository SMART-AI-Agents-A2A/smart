import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { v4 as uuidv4 } from 'uuid';
import type { ZodError } from 'zod';
import { buildSensorRange, getMeasurements, getSensorRows, rowsToCsv } from './influxdb.flux';
import { flattenGroupedPayload, groupSensorRows } from './influxdb.groups';
import {
    measurementsQuerySchema,
    sensorParamSchema,
    sensorQuerySchema,
    type ApiErrorResponse,
    type ApiSuccessResponse,
    type SensorGroupedPayload,
    type SensorMeasurement,
    type SensorRowsPayload,
    type ValidationIssue,
} from './influxdb.types';

export const influxdbRoutes = new Hono();

const createRequestId = (): string => {
    return uuidv4();
};

const success = <TData>(data: TData): ApiSuccessResponse<TData> => {
    return {
        requestId: createRequestId(),
        success: true,
        data,
    };
};

const fail = (message: string, issues?: readonly ValidationIssue[]): ApiErrorResponse => {
    return {
        requestId: createRequestId(),
        success: false,
        error: {
            message,
            issues,
        },
    };
};

const zodIssuesToValidationIssues = (error: ZodError): readonly ValidationIssue[] => {
    return error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || 'root',
        message: issue.message,
    }));
};

influxdbRoutes.get('/health', (c) => {
    return c.json(
        success({
            service: 'influxdb',
            status: 'ok',
        }),
    );
});

influxdbRoutes.get('/sensors', (c) => {
    const sensors: readonly SensorMeasurement[] = ['Atmos41', 'Teros12', 'WXT520'];

    return c.json(
        success({
            sensors,
        }),
    );
});

influxdbRoutes.get('/measurements', async (c) => {
    const parsedQuery = measurementsQuerySchema.safeParse(c.req.query());

    if (!parsedQuery.success) {
        return c.json(
            fail(
                'Query inválida para listar measurements.',
                zodIssuesToValidationIssues(parsedQuery.error),
            ),
            StatusCodes.BAD_REQUEST,
        );
    }

    const measurements = await getMeasurements(parsedQuery.data.bucket);

    return c.json(success(measurements));
});

influxdbRoutes.get('/sensors/:sensor', async (c) => {
    const parsedParam = sensorParamSchema.safeParse({
        sensor: c.req.param('sensor'),
    });

    if (!parsedParam.success) {
        return c.json(
            fail(
                'Sensor inválido. Use Atmos41, Teros12 ou WXT520.',
                zodIssuesToValidationIssues(parsedParam.error),
            ),
            StatusCodes.BAD_REQUEST,
        );
    }

    const parsedQuery = sensorQuerySchema.safeParse(c.req.query());

    if (!parsedQuery.success) {
        return c.json(
            fail(
                'Query inválida. O parâmetro start é obrigatório. Exemplos: start=-6h, start=-7d, start=-1mo ou start=2026-04-30T00:00:00Z.',
                zodIssuesToValidationIssues(parsedQuery.error),
            ),
            StatusCodes.BAD_REQUEST,
        );
    }

    const { sensor } = parsedParam.data;
    const query = parsedQuery.data;

    const rows = await getSensorRows(sensor, query);
    const range = buildSensorRange(query);

    if (query.format === 'csv') {
        const csv = rowsToCsv(rows);

        c.header('Content-Type', 'text/csv; charset=utf-8');
        c.header('Content-Disposition', `attachment; filename="${sensor}.csv"`);

        return c.text(csv, StatusCodes.OK);
    }

    const payload: SensorRowsPayload = {
        sensor,
        range,
        rows,
    };

    return c.json(success(payload));
});

influxdbRoutes.get('/sensors/:sensor/groups', async (c) => {
    const parsedParam = sensorParamSchema.safeParse({
        sensor: c.req.param('sensor'),
    });

    if (!parsedParam.success) {
        return c.json(
            fail(
                'Sensor inválido. Use Atmos41, Teros12 ou WXT520.',
                zodIssuesToValidationIssues(parsedParam.error),
            ),
            StatusCodes.BAD_REQUEST,
        );
    }

    const parsedQuery = sensorQuerySchema.safeParse(c.req.query());

    if (!parsedQuery.success) {
        return c.json(
            fail(
                'Query inválida. O parâmetro start é obrigatório. Exemplos: start=-6h, start=-7d, start=-1mo ou start=2026-04-30T00:00:00Z.',
                zodIssuesToValidationIssues(parsedQuery.error),
            ),
            StatusCodes.BAD_REQUEST,
        );
    }

    const { sensor } = parsedParam.data;
    const query = parsedQuery.data;

    const rows = await getSensorRows(sensor, query);
    const groupedPayload = groupSensorRows(sensor, rows, query);

    if (query.format === 'csv') {
        const flattenedRows = flattenGroupedPayload(groupedPayload);
        const csv = rowsToCsv(flattenedRows);

        c.header('Content-Type', 'text/csv; charset=utf-8');
        c.header('Content-Disposition', `attachment; filename="${sensor}-groups.csv"`);

        return c.text(csv, StatusCodes.OK);
    }

    return c.json(success<SensorGroupedPayload>(groupedPayload));
});

influxdbRoutes.onError((error, c) => {
    const message = error instanceof Error ? error.message : 'Erro interno desconhecido.';

    return c.json(fail(message), StatusCodes.INTERNAL_SERVER_ERROR);
});
