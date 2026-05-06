import { Hono } from 'hono';
import {
    getInfluxHealth,
    getInfluxMeasurements,
    getInfluxSensorGroupData,
    getInfluxSensorGroups,
    getInfluxSensors,
    handleInfluxError,
} from './influxdb.handlers';

export const influxdbRoutes = new Hono();

influxdbRoutes.get('/health', getInfluxHealth);
influxdbRoutes.get('/sensors', getInfluxSensors);
influxdbRoutes.get('/measurements', getInfluxMeasurements);
influxdbRoutes.get('/sensors/:sensor/groups', getInfluxSensorGroups);
influxdbRoutes.get('/sensors/:sensor/groups/:group/data', getInfluxSensorGroupData);

influxdbRoutes.onError(handleInfluxError);
