import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { validateZodData } from '../../core/validators';
import { getCachedMeasurements, getCachedSensorGroupData } from './influxdb.cache';
import { getSensorGroups, sensorHasGroup } from './influxdb.groups';
import { fail, success } from './influxdb.responses';
import type { SensorMeasurement } from './influxdb.type';
import { InfluxdbValueObject } from './influxdb.vo';

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
    const param = validateZodData(
        {
            sensor: c.req.param('sensor'),
        },
        (data) => InfluxdbValueObject.createSafeSensorParam(data),
        c,
        {
            message: 'Sensor inválido. Use Atmos41, Teros12 ou WXT520.',
            errorResponse: fail,
        },
    );

    if (!param.success) {
        return param.response;
    }

    return c.json(success(getSensorGroups(param.data.sensor)), StatusCodes.OK);
});

router.get('/sensors/:sensor/groups/:group/data', async (c) => {
    const param = validateZodData(
        {
            sensor: c.req.param('sensor'),
            group: c.req.param('group'),
        },
        (data) => InfluxdbValueObject.createSafeSensorGroupParam(data),
        c,
        {
            message: 'Sensor ou grupo inválido.',
            errorResponse: fail,
        },
    );

    if (!param.success) {
        return param.response;
    }

    if (!sensorHasGroup(param.data.sensor, param.data.group)) {
        return c.json(
            fail(`O grupo "${param.data.group}" não existe para o sensor "${param.data.sensor}".`),
            StatusCodes.BAD_REQUEST,
        );
    }

    const query = validateZodData(
        c.req.query(),
        (data) => InfluxdbValueObject.createSafeSensorDataQuery(data),
        c,
        {
            message:
                'Query inválida. Informe start e every. farmCode usa Faz_NSAAB neste MVP. Exemplos: start=-7d&every=20m ou start=2026-05-01T00:00:00Z&stop=2026-05-06T12:00:00Z&every=1h.',
            errorResponse: fail,
        },
    );

    if (!query.success) {
        return query.response;
    }

    const payload = await getCachedSensorGroupData(
        c.env,
        param.data.sensor,
        param.data.group,
        query.data,
    );

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
