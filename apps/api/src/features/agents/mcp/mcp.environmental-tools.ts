import { z } from 'zod';
import {
    getCachedSensorGroupData,
    defaultFarmCode,
    fluxDurationSchema,
    fluxTimeSchema,
    type SensorDataQuery,
    type SensorGroupName,
} from '../tools/influxdb';
import {
    getCachedForecastWeather,
    getOpenWeatherFarmLocation,
    forecastCountFromQuerySchema,
    openWeatherQuerySchema,
    openWeatherUnitsSchema,
} from '../tools/openweather';
import { McpToolRegistry, type McpToolContext } from './core';

const toolFarmCodeSchema = z.literal(defaultFarmCode).default(defaultFarmCode);

const sensorRangeInputSchema = z.object({
    farmCode: toolFarmCodeSchema,
    start: fluxTimeSchema.default('-6h'),
    stop: fluxTimeSchema.optional(),
    every: fluxDurationSchema.default('20m'),
});

const soilGroupSchema = z.enum([
    'Umidade do Solo',
    'Temperatura do Solo',
    'Condutividade Elétrica',
]);

const soilDataInputSchema = sensorRangeInputSchema.extend({
    group: soilGroupSchema.default('Umidade do Solo'),
});

const rainAccumulatedInputSchema = sensorRangeInputSchema;

const rainForecastInputSchema = z.object({
    farmCode: toolFarmCodeSchema,
    units: openWeatherUnitsSchema.default('metric'),
    lang: z.string().min(2).max(8).default('pt_br'),
    cnt: forecastCountFromQuerySchema.optional(),
});

const sensorRangeInputJsonSchema = {
    type: 'object',
    properties: {
        farmCode: {
            type: 'string',
            const: defaultFarmCode,
            default: defaultFarmCode,
        },
        start: {
            type: 'string',
            default: '-6h',
        },
        stop: {
            type: 'string',
        },
        every: {
            type: 'string',
            default: '20m',
        },
    },
    additionalProperties: false,
} as const;

const soilDataJsonSchema = {
    ...sensorRangeInputJsonSchema,
    properties: {
        ...sensorRangeInputJsonSchema.properties,
        group: {
            type: 'string',
            enum: ['Umidade do Solo', 'Temperatura do Solo', 'Condutividade Elétrica'],
            default: 'Umidade do Solo',
        },
    },
} as const;

const rainForecastJsonSchema = {
    type: 'object',
    properties: {
        farmCode: {
            type: 'string',
            const: defaultFarmCode,
            default: defaultFarmCode,
        },
        units: {
            type: 'string',
            enum: ['standard', 'metric', 'imperial'],
            default: 'metric',
        },
        lang: {
            type: 'string',
            default: 'pt_br',
        },
        cnt: {
            type: 'number',
            minimum: 1,
            maximum: 40,
        },
    },
    additionalProperties: false,
} as const;

const sensorQueryFromInput = (input: z.infer<typeof sensorRangeInputSchema>): SensorDataQuery => {
    return {
        farmCode: input.farmCode,
        start: input.start,
        stop: input.stop,
        every: input.every,
    };
};

const measuredDataEnvelope = (sensor: 'Atmos41' | 'Teros12', structuredContent: unknown) => ({
    sourceKind: 'measured' as const,
    sourceSystem: 'influxdb' as const,
    sourceLabel: 'Dados medidos pelos sensores da Fazenda NSAAB',
    farmCode: defaultFarmCode,
    sensor,
    external: false,
    payload: structuredContent,
});

const externalDataEnvelope = (structuredContent: unknown) => ({
    sourceKind: 'external' as const,
    sourceSystem: 'openweather' as const,
    sourceLabel: 'Dados externos da API OpenWeather',
    farmCode: defaultFarmCode,
    external: true,
    payload: structuredContent,
});

const jsonToolResult = (text: string, structuredContent: unknown) => ({
    content: [
        {
            type: 'text' as const,
            text,
        },
        {
            type: 'json' as const,
            data: structuredContent,
        },
    ],
    structuredContent,
});

const registerSoilDataTool = (registry: McpToolRegistry) => {
    registry.register({
        name: 'smart_soil_data',
        description:
            'Consulta dados de solo da Fazenda NSAAB usando sensor Teros12 via cache ambiental.',
        inputSchema: soilDataInputSchema,
        jsonSchema: soilDataJsonSchema,
        annotations: {
            farmCode: defaultFarmCode,
            sensor: 'Teros12',
            source: 'influxdb-cache',
        },
        handler: async (input, context: McpToolContext) => {
            const payload = await getCachedSensorGroupData(
                context.env,
                'Teros12',
                input.group as SensorGroupName,
                sensorQueryFromInput(input),
            );
            const structuredContent = measuredDataEnvelope('Teros12', payload);

            return jsonToolResult(
                `Dados medidos do InfluxDB consultados para ${defaultFarmCode} via Teros12.`,
                structuredContent,
            );
        },
    });
};

const registerRainAccumulatedTool = (registry: McpToolRegistry) => {
    registry.register({
        name: 'smart_rain_accumulated',
        description:
            'Consulta chuva acumulada da Fazenda NSAAB usando sensor Atmos41 via cache ambiental.',
        inputSchema: rainAccumulatedInputSchema,
        jsonSchema: sensorRangeInputJsonSchema,
        annotations: {
            farmCode: defaultFarmCode,
            sensor: 'Atmos41',
            group: 'Chuva',
            source: 'influxdb-cache',
        },
        handler: async (input, context: McpToolContext) => {
            const payload = await getCachedSensorGroupData(
                context.env,
                'Atmos41',
                'Chuva',
                sensorQueryFromInput(input),
            );
            const structuredContent = measuredDataEnvelope('Atmos41', payload);

            return jsonToolResult(
                `Dados medidos do InfluxDB consultados para ${defaultFarmCode} via Atmos41.`,
                structuredContent,
            );
        },
    });
};

const registerRainForecastTool = (registry: McpToolRegistry) => {
    registry.register({
        name: 'smart_rain_forecast',
        description:
            'Consulta previsão de chuva da Fazenda NSAAB usando OpenWeather via cache ambiental.',
        inputSchema: rainForecastInputSchema,
        jsonSchema: rainForecastJsonSchema,
        annotations: {
            farmCode: defaultFarmCode,
            source: 'openweather-cache',
        },
        handler: async (input, context: McpToolContext) => {
            const farm = getOpenWeatherFarmLocation();
            const query = openWeatherQuerySchema.parse(input);
            const payload = await getCachedForecastWeather(context.env, farm, query);
            const structuredContent = externalDataEnvelope({
                farm,
                query,
                ...payload,
            });

            return jsonToolResult(
                `Dados externos consultados para ${defaultFarmCode} via OpenWeather.`,
                structuredContent,
            );
        },
    });
};

export const createEnvironmentalMcpRegistry = (): McpToolRegistry => {
    const registry = new McpToolRegistry();

    registerSoilDataTool(registry);
    registerRainAccumulatedTool(registry);
    registerRainForecastTool(registry);

    return registry;
};
