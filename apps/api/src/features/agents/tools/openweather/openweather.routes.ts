import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { getCurrentWeather, getForecastWeather } from './openweather.connect';
import { getOpenWeatherFarmLocation } from './openweather.geojson';
import {
    validateOpenWeatherQuery,
    type DataResponse,
    type ErrorResponse,
    type OpenWeatherCurrentPayload,
    type OpenWeatherFarmLocation,
    type OpenWeatherForecastPayload,
    type OpenWeatherSummaryPayload,
} from './openweather.types';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.get('/health', (c) => {
    return c.json<DataResponse<{ service: string; status: string }>>(
        {
            success: true,
            data: {
                service: 'openweather',
                status: 'ok',
            },
        },
        StatusCodes.OK,
    );
});

router.get('/farm/location', (c) => {
    const farm = getOpenWeatherFarmLocation();

    return c.json<DataResponse<OpenWeatherFarmLocation>>(
        {
            success: true,
            data: farm,
        },
        StatusCodes.OK,
    );
});

router.get('/farm/current', async (c) => {
    const query = validateOpenWeatherQuery(c);

    if (!query.success) {
        return query.response;
    }

    const farm = getOpenWeatherFarmLocation();
    const weather = await getCurrentWeather(c.env, farm, query.data);

    const payload: OpenWeatherCurrentPayload = {
        source: 'openweather',
        type: 'current',
        farm,
        query: query.data,
        weather,
    };

    return c.json<DataResponse<OpenWeatherCurrentPayload>>(
        {
            success: true,
            data: payload,
        },
        StatusCodes.OK,
    );
});

router.get('/farm/forecast', async (c) => {
    const query = validateOpenWeatherQuery(c);

    if (!query.success) {
        return query.response;
    }

    const farm = getOpenWeatherFarmLocation();
    const forecast = await getForecastWeather(c.env, farm, query.data);

    const payload: OpenWeatherForecastPayload = {
        source: 'openweather',
        type: 'forecast',
        farm,
        query: query.data,
        forecast,
    };

    return c.json<DataResponse<OpenWeatherForecastPayload>>(
        {
            success: true,
            data: payload,
        },
        StatusCodes.OK,
    );
});

router.get('/farm/summary', async (c) => {
    const query = validateOpenWeatherQuery(c);

    if (!query.success) {
        return query.response;
    }

    const farm = getOpenWeatherFarmLocation();

    const [current, forecast] = await Promise.all([
        getCurrentWeather(c.env, farm, query.data),
        getForecastWeather(c.env, farm, query.data),
    ]);

    const payload: OpenWeatherSummaryPayload = {
        source: 'openweather',
        type: 'summary',
        farm,
        query: query.data,
        current,
        forecast,
    };

    return c.json<DataResponse<OpenWeatherSummaryPayload>>(
        {
            success: true,
            data: payload,
        },
        StatusCodes.OK,
    );
});

router.onError((error, c) => {
    console.error('Error /v1/openweather:', error);

    return c.json<ErrorResponse>(
        {
            success: false,
            message: 'Falha inesperada ao consultar OpenWeather.',
        },
        StatusCodes.INTERNAL_SERVER_ERROR,
    );
});

export { router as openWeatherRoutes };
