import type { Context } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { fail, zodIssuesToValidationIssues } from './influxdb.responses';
import {
    sensorDataQuerySchema,
    sensorGroupParamSchema,
    sensorParamSchema,
    type SensorDataQuery,
    type SensorGroupParam,
    type SensorParam,
} from './influxdb.types';

export const validateSensorParam = (c: Context): SensorParam | Response => {
    const parsed = sensorParamSchema.safeParse({
        sensor: c.req.param('sensor'),
    });

    if (!parsed.success) {
        return c.json(
            fail(
                'Sensor inválido. Use Atmos41, Teros12 ou WXT520.',
                zodIssuesToValidationIssues(parsed.error),
            ),
            StatusCodes.BAD_REQUEST,
        );
    }

    return parsed.data;
};

export const validateSensorGroupParam = (c: Context): SensorGroupParam | Response => {
    const parsed = sensorGroupParamSchema.safeParse({
        sensor: c.req.param('sensor'),
        group: c.req.param('group'),
    });

    if (!parsed.success) {
        return c.json(
            fail('Sensor ou grupo inválido.', zodIssuesToValidationIssues(parsed.error)),
            StatusCodes.BAD_REQUEST,
        );
    }

    return parsed.data;
};

export const validateSensorDataQuery = (c: Context): SensorDataQuery | Response => {
    const parsed = sensorDataQuerySchema.safeParse(c.req.query());

    if (!parsed.success) {
        return c.json(
            fail(
                'Query inválida. Informe start e every. Exemplos: start=-7d&every=20m ou start=2026-05-01T00:00:00Z&stop=2026-05-06T12:00:00Z&every=1h.',
                zodIssuesToValidationIssues(parsed.error),
            ),
            StatusCodes.BAD_REQUEST,
        );
    }

    return parsed.data;
};
