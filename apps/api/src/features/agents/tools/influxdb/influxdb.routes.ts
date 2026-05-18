import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { getMeasurements, getSensorRows } from './influxdb.flux';
import { getSensorGroups, groupSensorRows, sensorHasGroup } from './influxdb.groups';
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
    const measurements = await getMeasurements();

    return c.json(success(measurements), StatusCodes.OK);
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

    const rows = await getSensorRows(param.sensor, query);
    const payload = groupSensorRows(param.sensor, param.group, rows, query);

    return c.json(success(payload), StatusCodes.OK);
});

router.onError((error, c) => {
    const message = error instanceof Error ? error.message : 'Erro interno desconhecido.';

    return c.json(fail(message), StatusCodes.INTERNAL_SERVER_ERROR);
});

export { router as influxdbRouter };
