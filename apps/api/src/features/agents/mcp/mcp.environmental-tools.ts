import { z } from 'zod';
import {
    getCachedSensorGroupData,
    defaultFarmCode,
    fluxDurationSchema,
    fluxTimeSchema,
    type SensorDataQuery,
    type SensorFieldSeries,
    type SensorGroupedPayload,
    type SensorGroupName,
} from '../tools/influxdb';
import type { CacheSnapshot } from '../tools/cache';
import {
    getCachedCurrentWeather,
    getCachedForecastWeather,
    getOpenWeatherFarmLocation,
    forecastCountFromQuerySchema,
    openWeatherQuerySchema,
    openWeatherUnitsSchema,
} from '../tools/openweather';
import {
    createMcpExternalDataEnvelope,
    createMcpJsonToolResult,
    createMcpMeasuredDataEnvelope,
    createMcpToolRegistry,
    type McpToolContext,
    type McpToolRegistry,
} from './core';

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

const radiationSolarInputSchema = sensorRangeInputSchema;

const windSpeedInputSchema = sensorRangeInputSchema;

const windDirectionInputSchema = sensorRangeInputSchema;

const windGustInputSchema = sensorRangeInputSchema;

const airTemperatureInputSchema = sensorRangeInputSchema;

const airHumidityInputSchema = sensorRangeInputSchema;

const airPressureInputSchema = sensorRangeInputSchema;

const airConditionsInputSchema = sensorRangeInputSchema;

const airCurrentWeatherInputSchema = z.object({
    farmCode: toolFarmCodeSchema,
    units: openWeatherUnitsSchema.default('metric'),
    lang: z.string().min(2).max(8).default('pt_br'),
});

const airFieldNames = ['AirTemperature', 'AirHumidity', 'AtmPressure', 'VaporPressure'] as const;
type AirFieldName = (typeof airFieldNames)[number];

const windFieldNames = ['WindDirection', 'WindSpeed', 'WindGust'] as const;
type WindFieldName = (typeof windFieldNames)[number];

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

const airCurrentWeatherJsonSchema = {
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

const sensorPayloadHasData = (payload: CacheSnapshot<SensorGroupedPayload>): boolean => {
    return payload.data.groups.some((group) => group.fields.length > 0);
};

const filterSensorPayloadFields = (
    payload: CacheSnapshot<SensorGroupedPayload>,
    fields: readonly (AirFieldName | WindFieldName)[],
): CacheSnapshot<SensorGroupedPayload> => {
    const selectedFields = new Set<string>(fields);
    const filteredGroups = payload.data.groups.map((group) => ({
        ...group,
        fields: group.fields.filter((field): field is SensorFieldSeries =>
            selectedFields.has(field.field),
        ),
    }));

    return {
        ...payload,
        data: {
            ...payload.data,
            groups: filteredGroups,
        },
    };
};

const createMeasuredDataEnvelope = (
    sensor: 'Atmos41' | 'Teros12',
    structuredContent: CacheSnapshot<SensorGroupedPayload>,
) => {
    const hasData = sensorPayloadHasData(structuredContent);

    return createMcpMeasuredDataEnvelope({
        farmCode: defaultFarmCode,
        sensor,
        hasData,
        emptyReason: hasData
            ? null
            : 'Nenhum campo com séries foi encontrado para o sensor, grupo e janela informados.',
        payload: structuredContent,
    });
};

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
            const structuredContent = createMeasuredDataEnvelope('Teros12', payload);

            return createMcpJsonToolResult(
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
            const structuredContent = createMeasuredDataEnvelope('Atmos41', payload);

            return createMcpJsonToolResult(
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
            const structuredContent = createMcpExternalDataEnvelope({
                farmCode: defaultFarmCode,
                payload: {
                    farm,
                    query,
                    ...payload,
                },
            });

            return createMcpJsonToolResult(
                `Dados externos consultados para ${defaultFarmCode} via OpenWeather.`,
                structuredContent,
            );
        },
    });
};

const registerRadiationSolarTool = (registry: McpToolRegistry) => {
    registry.register({
        name: 'smart_radiation_solar',
        description:
            'Consulta radiação solar medida da Fazenda NSAAB usando sensor Atmos41 via cache ambiental.',
        inputSchema: radiationSolarInputSchema,
        jsonSchema: sensorRangeInputJsonSchema,
        annotations: {
            farmCode: defaultFarmCode,
            sensor: 'Atmos41',
            group: 'Radiação Solar',
            source: 'influxdb-cache',
        },
        handler: async (input, context: McpToolContext) => {
            const payload = await getCachedSensorGroupData(
                context.env,
                'Atmos41',
                'Radiação Solar',
                sensorQueryFromInput(input),
            );
            const structuredContent = createMeasuredDataEnvelope('Atmos41', payload);

            return createMcpJsonToolResult(
                `Dados medidos de radiação solar consultados para ${defaultFarmCode} via Atmos41.`,
                structuredContent,
            );
        },
    });
};

const registerWindSpeedTool = (registry: McpToolRegistry) => {
    registry.register({
        name: 'smart_wind_speed',
        description:
            'Consulta velocidade do vento medida da Fazenda NSAAB usando sensor Atmos41 via cache ambiental.',
        inputSchema: windSpeedInputSchema,
        jsonSchema: sensorRangeInputJsonSchema,
        annotations: {
            farmCode: defaultFarmCode,
            sensor: 'Atmos41',
            group: 'Vento',
            fields: ['WindSpeed'],
            source: 'influxdb-cache',
        },
        handler: async (input, context: McpToolContext) => {
            const payload = await getCachedSensorGroupData(
                context.env,
                'Atmos41',
                'Vento',
                sensorQueryFromInput(input),
            );
            const structuredContent = createMeasuredDataEnvelope(
                'Atmos41',
                filterSensorPayloadFields(payload, ['WindSpeed']),
            );

            return createMcpJsonToolResult(
                `Dados medidos de velocidade do vento consultados para ${defaultFarmCode} via Atmos41.`,
                structuredContent,
            );
        },
    });
};

const registerWindDirectionTool = (registry: McpToolRegistry) => {
    registry.register({
        name: 'smart_wind_direction',
        description:
            'Consulta direção do vento medida da Fazenda NSAAB usando sensor Atmos41 via cache ambiental.',
        inputSchema: windDirectionInputSchema,
        jsonSchema: sensorRangeInputJsonSchema,
        annotations: {
            farmCode: defaultFarmCode,
            sensor: 'Atmos41',
            group: 'Vento',
            fields: ['WindDirection'],
            source: 'influxdb-cache',
        },
        handler: async (input, context: McpToolContext) => {
            const payload = await getCachedSensorGroupData(
                context.env,
                'Atmos41',
                'Vento',
                sensorQueryFromInput(input),
            );
            const structuredContent = createMeasuredDataEnvelope(
                'Atmos41',
                filterSensorPayloadFields(payload, ['WindDirection']),
            );

            return createMcpJsonToolResult(
                `Dados medidos de direção do vento consultados para ${defaultFarmCode} via Atmos41.`,
                structuredContent,
            );
        },
    });
};

const registerWindGustTool = (registry: McpToolRegistry) => {
    registry.register({
        name: 'smart_wind_gust',
        description:
            'Consulta rajadas de vento medidas da Fazenda NSAAB usando sensor Atmos41 via cache ambiental.',
        inputSchema: windGustInputSchema,
        jsonSchema: sensorRangeInputJsonSchema,
        annotations: {
            farmCode: defaultFarmCode,
            sensor: 'Atmos41',
            group: 'Vento',
            fields: ['WindGust'],
            source: 'influxdb-cache',
        },
        handler: async (input, context: McpToolContext) => {
            const payload = await getCachedSensorGroupData(
                context.env,
                'Atmos41',
                'Vento',
                sensorQueryFromInput(input),
            );
            const structuredContent = createMeasuredDataEnvelope(
                'Atmos41',
                filterSensorPayloadFields(payload, ['WindGust']),
            );

            return createMcpJsonToolResult(
                `Dados medidos de rajadas de vento consultados para ${defaultFarmCode} via Atmos41.`,
                structuredContent,
            );
        },
    });
};

const registerAirTemperatureTool = (registry: McpToolRegistry) => {
    registry.register({
        name: 'smart_air_temperature',
        description:
            'Consulta temperatura do ar medida da Fazenda NSAAB usando sensor Atmos41 via cache ambiental.',
        inputSchema: airTemperatureInputSchema,
        jsonSchema: sensorRangeInputJsonSchema,
        annotations: {
            farmCode: defaultFarmCode,
            sensor: 'Atmos41',
            group: 'Ar',
            fields: ['AirTemperature'],
            source: 'influxdb-cache',
        },
        handler: async (input, context: McpToolContext) => {
            const payload = await getCachedSensorGroupData(
                context.env,
                'Atmos41',
                'Ar',
                sensorQueryFromInput(input),
            );
            const structuredContent = createMeasuredDataEnvelope(
                'Atmos41',
                filterSensorPayloadFields(payload, ['AirTemperature']),
            );

            return createMcpJsonToolResult(
                `Dados medidos de temperatura do ar consultados para ${defaultFarmCode} via Atmos41.`,
                structuredContent,
            );
        },
    });
};

const registerAirHumidityTool = (registry: McpToolRegistry) => {
    registry.register({
        name: 'smart_air_humidity',
        description:
            'Consulta umidade do ar medida da Fazenda NSAAB usando sensor Atmos41 via cache ambiental.',
        inputSchema: airHumidityInputSchema,
        jsonSchema: sensorRangeInputJsonSchema,
        annotations: {
            farmCode: defaultFarmCode,
            sensor: 'Atmos41',
            group: 'Ar',
            fields: ['AirHumidity'],
            source: 'influxdb-cache',
        },
        handler: async (input, context: McpToolContext) => {
            const payload = await getCachedSensorGroupData(
                context.env,
                'Atmos41',
                'Ar',
                sensorQueryFromInput(input),
            );
            const structuredContent = createMeasuredDataEnvelope(
                'Atmos41',
                filterSensorPayloadFields(payload, ['AirHumidity']),
            );

            return createMcpJsonToolResult(
                `Dados medidos de umidade do ar consultados para ${defaultFarmCode} via Atmos41.`,
                structuredContent,
            );
        },
    });
};

const registerAirPressureTool = (registry: McpToolRegistry) => {
    registry.register({
        name: 'smart_air_pressure',
        description:
            'Consulta pressão atmosférica medida da Fazenda NSAAB usando sensor Atmos41 via cache ambiental.',
        inputSchema: airPressureInputSchema,
        jsonSchema: sensorRangeInputJsonSchema,
        annotations: {
            farmCode: defaultFarmCode,
            sensor: 'Atmos41',
            group: 'Ar',
            fields: ['AtmPressure'],
            source: 'influxdb-cache',
        },
        handler: async (input, context: McpToolContext) => {
            const payload = await getCachedSensorGroupData(
                context.env,
                'Atmos41',
                'Ar',
                sensorQueryFromInput(input),
            );
            const structuredContent = createMeasuredDataEnvelope(
                'Atmos41',
                filterSensorPayloadFields(payload, ['AtmPressure']),
            );

            return createMcpJsonToolResult(
                `Dados medidos de pressão atmosférica consultados para ${defaultFarmCode} via Atmos41.`,
                structuredContent,
            );
        },
    });
};

const registerAirConditionsTool = (registry: McpToolRegistry) => {
    registry.register({
        name: 'smart_air_conditions',
        description:
            'Consulta condições gerais do ar da Fazenda NSAAB usando sensor Atmos41 via cache ambiental.',
        inputSchema: airConditionsInputSchema,
        jsonSchema: sensorRangeInputJsonSchema,
        annotations: {
            farmCode: defaultFarmCode,
            sensor: 'Atmos41',
            group: 'Ar',
            fields: airFieldNames,
            source: 'influxdb-cache',
        },
        handler: async (input, context: McpToolContext) => {
            const payload = await getCachedSensorGroupData(
                context.env,
                'Atmos41',
                'Ar',
                sensorQueryFromInput(input),
            );
            const structuredContent = createMeasuredDataEnvelope('Atmos41', payload);

            return createMcpJsonToolResult(
                `Dados medidos de condições gerais do ar consultados para ${defaultFarmCode} via Atmos41.`,
                structuredContent,
            );
        },
    });
};

const registerAirCurrentWeatherTool = (registry: McpToolRegistry) => {
    registry.register({
        name: 'smart_air_current_weather',
        description:
            'Consulta condições atuais do ar da Fazenda NSAAB usando OpenWeather via cache ambiental.',
        inputSchema: airCurrentWeatherInputSchema,
        jsonSchema: airCurrentWeatherJsonSchema,
        annotations: {
            farmCode: defaultFarmCode,
            source: 'openweather-cache',
            metrics: ['temperature', 'humidity', 'pressure', 'conditions'],
        },
        handler: async (input, context: McpToolContext) => {
            const farm = getOpenWeatherFarmLocation();
            const query = openWeatherQuerySchema.parse(input);
            const payload = await getCachedCurrentWeather(context.env, farm, query);
            const structuredContent = createMcpExternalDataEnvelope({
                farmCode: defaultFarmCode,
                payload: {
                    farm,
                    query,
                    ...payload,
                },
            });

            return createMcpJsonToolResult(
                `Dados externos atuais consultados para ${defaultFarmCode} via OpenWeather.`,
                structuredContent,
            );
        },
    });
};

export const createEnvironmentalMcpRegistry = (): McpToolRegistry => {
    return createMcpToolRegistry([
        registerSoilDataTool,
        registerRainAccumulatedTool,
        registerRainForecastTool,
        registerRadiationSolarTool,
        registerWindSpeedTool,
        registerWindDirectionTool,
        registerWindGustTool,
        registerAirTemperatureTool,
        registerAirHumidityTool,
        registerAirPressureTool,
        registerAirConditionsTool,
        registerAirCurrentWeatherTool,
    ]);
};
