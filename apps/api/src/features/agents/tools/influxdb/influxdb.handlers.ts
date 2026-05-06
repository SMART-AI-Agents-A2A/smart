import type { Context } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { getMeasurements, getSensorRows } from './influxdb.flux';
import { getSensorGroups, groupSensorRows, sensorHasGroup } from './influxdb.groups';
import { fail, success } from './influxdb.responses';
import {
    validateSensorDataQuery,
    validateSensorGroupParam,
    validateSensorParam,
} from './influxdb.validator';
import type { SensorMeasurement } from './influxdb.types';

export const getInfluxHealth = (c: Context) => {
    return c.json(
        success({
            service: 'influxdb',
            status: 'ok',
        }),
    );
};

export const getInfluxSensors = (c: Context) => {
    const sensors: readonly SensorMeasurement[] = ['Atmos41', 'Teros12', 'WXT520'];

    return c.json(success({ sensors }));
};

export const getInfluxMeasurements = async (c: Context) => {
    const measurements = await getMeasurements();

    return c.json(success(measurements));
};

export const getInfluxSensorGroups = (c: Context) => {
    const param = validateSensorParam(c);

    if (param instanceof Response) {
        return param;
    }

    return c.json(success(getSensorGroups(param.sensor)));
};

export const getInfluxSensorGroupData = async (c: Context) => {
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

    return c.json(success(payload));
};

export const handleInfluxError = (error: Error, c: Context) => {
    const message = error instanceof Error ? error.message : 'Erro interno desconhecido.';

    return c.json(fail(message), StatusCodes.INTERNAL_SERVER_ERROR);
};
