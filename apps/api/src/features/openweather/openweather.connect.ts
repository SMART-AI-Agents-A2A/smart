import { type ZodType } from 'zod';
import {
    openWeatherCurrentResponseSchema,
    openWeatherForecastResponseSchema,
    parseOpenWeatherEnv,
    type OpenWeatherCurrentResponse,
    type OpenWeatherFarmLocation,
    type OpenWeatherForecastResponse,
    type OpenWeatherQuery,
} from './openweather.vo';

const buildSearchParams = (
    farm: OpenWeatherFarmLocation,
    query: OpenWeatherQuery,
    apiKey: string,
): URLSearchParams => {
    const params = new URLSearchParams();

    params.set('appid', apiKey);
    params.set('lat', String(farm.latitude));
    params.set('lon', String(farm.longitude));
    params.set('units', query.units);
    params.set('lang', query.lang);

    if (query.cnt !== undefined) {
        params.set('cnt', String(query.cnt));
    }

    return params;
};

const requestOpenWeather = async <TResponse>(
    path: '/weather' | '/forecast',
    rawEnv: unknown,
    farm: OpenWeatherFarmLocation,
    query: OpenWeatherQuery,
    schema: ZodType<TResponse>,
): Promise<TResponse> => {
    const env = parseOpenWeatherEnv(rawEnv);

    const params = buildSearchParams(farm, query, env.OPENWEATHER_API);

    const url = `${env.OPENWEATHER_URL}${path}?${params.toString()}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
    });

    const payload: unknown = await response.json();

    if (!response.ok) {
        throw new Error(
            `OpenWeather falhou com status ${response.status}: ${JSON.stringify(payload)}`,
        );
    }

    return schema.parse(payload);
};

export const getCurrentWeather = async (
    rawEnv: unknown,
    farm: OpenWeatherFarmLocation,
    query: OpenWeatherQuery,
): Promise<OpenWeatherCurrentResponse> => {
    return requestOpenWeather('/weather', rawEnv, farm, query, openWeatherCurrentResponseSchema);
};

export const getForecastWeather = async (
    rawEnv: unknown,
    farm: OpenWeatherFarmLocation,
    query: OpenWeatherQuery,
): Promise<OpenWeatherForecastResponse> => {
    return requestOpenWeather('/forecast', rawEnv, farm, query, openWeatherForecastResponseSchema);
};
