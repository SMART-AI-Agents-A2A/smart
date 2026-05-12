import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { getCachedMeasurements, getCachedSensorGroupData } from './influxdb.cache';
import { getSensorGroups, sensorHasGroup } from './influxdb.groups';
import { fail, success } from './influxdb.responses';
import type { SensorMeasurement } from './influxdb.types';
import {
    validateSensorDataQuery,
    validateSensorGroupParam,
    validateSensorParam,
} from './influxdb.validator';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.get('/health', (c) => {
    return c.json(
        success({
            service: 'influxdb',
            status: 'ok',
        }),
        StatusCodes.OK,
    );
});

router.get('/sensors', (c) => {
    const sensors: readonly SensorMeasurement[] = ['Atmos41', 'Teros12', 'WXT520'];

    return c.json(success({ sensors }), StatusCodes.OK);
});

router.get('/measurements', async (c) => {
    const measurements = await getCachedMeasurements(c.env);

    return c.json(
        success({
            measurements: measurements.data,
            cache: measurements.cache,
        }),
        StatusCodes.OK,
    );
});

router.get('/sensors/:sensor/groups', (c) => {
    const param = validateSensorParam(c);

    if (param instanceof Response) {
        return param;
    }

    return c.json(success(getSensorGroups(param.sensor)), StatusCodes.OK);
});

router.get('/sensors/:sensor/groups/:group/data', async (c) => {
    const param = validateSensorGroupParam(c);

    if (param instanceof Response) {
        return param;
    }

    if (!sensorHasGroup(param.sensor, param.group)) {
        return c.json(
            fail(`O grupo "${param.group}" não existe para o sensor "${param.sensor}".`),
            StatusCodes.BAD_REQUEST,
        );
    }

    const query = validateSensorDataQuery(c);

    if (query instanceof Response) {
        return query;
    }

    const payload = await getCachedSensorGroupData(c.env, param.sensor, param.group, query);

    return c.json(
        success({
            ...payload.data,
            cache: payload.cache,
        }),
        StatusCodes.OK,
    );
});

router.onError((error, c) => {
    const message = error instanceof Error ? error.message : 'Erro interno desconhecido.';

    return c.json(fail(message), StatusCodes.INTERNAL_SERVER_ERROR);
});

export { router as influxdbRouter };
