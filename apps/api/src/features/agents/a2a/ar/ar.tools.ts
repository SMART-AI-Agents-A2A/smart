import { z } from 'zod';
import {
    defaultFarmCode,
    fluxDurationSchema,
    fluxTimeSchema,
} from '../../tools/influxdb/influxdb.types';
import {
    openWeatherQuerySchema,
    openWeatherUnitsSchema,
} from '../../tools/openweather/openweather.types';
import type { MessageSendParams } from '../core';

export const airAgentMetricSchema = z.enum(['temperature', 'humidity', 'pressure', 'conditions']);
export type AirAgentMetric = z.infer<typeof airAgentMetricSchema>;

export const airAgentActionSchema = z.enum(['measured', 'current']);
export type AirAgentAction = z.infer<typeof airAgentActionSchema>;

export const airAgentSourceSchema = z.enum(['sensor', 'external']);
export type AirAgentSource = z.infer<typeof airAgentSourceSchema>;

export const airAgentPointLimitSchema = z.union([
    z.literal('all'),
    z.number().int().min(1).max(500),
]);
export type AirAgentPointLimit = z.infer<typeof airAgentPointLimitSchema>;

export const airAgentMetadataSchema = z
    .object({
        farmCode: z.literal(defaultFarmCode).optional(),
        action: airAgentActionSchema.optional(),
        metric: airAgentMetricSchema.optional(),
        source: airAgentSourceSchema.optional(),
        start: fluxTimeSchema.optional(),
        stop: fluxTimeSchema.optional(),
        every: fluxDurationSchema.optional(),
        units: openWeatherUnitsSchema.optional(),
        lang: z.string().min(2).max(8).optional(),
        pointLimit: airAgentPointLimitSchema.optional(),
    })
    .passthrough();
export type AirAgentMetadata = z.infer<typeof airAgentMetadataSchema>;

export const airAgentDataPartSchema = airAgentMetadataSchema;
export type AirAgentDataPart = z.infer<typeof airAgentDataPartSchema>;

export const airAgentMcpArgumentsSchema = z.object({
    farmCode: z.literal(defaultFarmCode),
    start: fluxTimeSchema,
    stop: fluxTimeSchema.optional(),
    every: fluxDurationSchema,
});
export type AirAgentMcpArguments = z.infer<typeof airAgentMcpArgumentsSchema>;

export const airExternalMcpArgumentsSchema = openWeatherQuerySchema.extend({
    farmCode: z.literal(defaultFarmCode),
});
export type AirExternalMcpArguments = z.infer<typeof airExternalMcpArgumentsSchema>;

export interface AirAgentRequestData {
    readonly metadata: AirAgentMetadata;
    readonly data: AirAgentDataPart;
}

export const mcpToolByAirMetric: Record<AirAgentMetric, string> = {
    temperature: 'smart_air_temperature',
    humidity: 'smart_air_humidity',
    pressure: 'smart_air_pressure',
    conditions: 'smart_air_conditions',
};

export const airMetricLabel: Record<AirAgentMetric, string> = {
    temperature: 'temperatura do ar',
    humidity: 'umidade do ar',
    pressure: 'pressão atmosférica',
    conditions: 'condições gerais do ar',
};

export const extractAirAgentRequestData = (params: MessageSendParams): AirAgentRequestData => {
    const metadata = airAgentMetadataSchema.parse(params.metadata);
    const dataPart = params.message.parts.find((part) => part.kind === 'data');
    const data = airAgentDataPartSchema.parse(dataPart?.data ?? {});

    return {
        metadata,
        data,
    };
};

export const getAirAgentMetric = (requestData: AirAgentRequestData): AirAgentMetric => {
    return requestData.data.metric ?? requestData.metadata.metric ?? 'conditions';
};

export const getAirAgentSource = (requestData: AirAgentRequestData): AirAgentSource => {
    const explicitSource = requestData.data.source ?? requestData.metadata.source;
    const action = requestData.data.action ?? requestData.metadata.action;

    if (explicitSource) return explicitSource;

    return action === 'current' ? 'external' : 'sensor';
};

export const getAirAgentAction = (requestData: AirAgentRequestData): AirAgentAction => {
    const explicitAction = requestData.data.action ?? requestData.metadata.action;
    const source = requestData.data.source ?? requestData.metadata.source;

    if (explicitAction) return explicitAction;

    return source === 'external' ? 'current' : 'measured';
};

export const createAirMcpArguments = (requestData: AirAgentRequestData): AirAgentMcpArguments => {
    return airAgentMcpArgumentsSchema.parse({
        farmCode: defaultFarmCode,
        start: requestData.data.start ?? requestData.metadata.start ?? '-6h',
        stop: requestData.data.stop ?? requestData.metadata.stop,
        every: requestData.data.every ?? requestData.metadata.every ?? '20m',
    });
};

export const getAirPointLimit = (
    requestData: AirAgentRequestData,
): AirAgentPointLimit | undefined => requestData.data.pointLimit ?? requestData.metadata.pointLimit;

export const createAirExternalMcpArguments = (
    requestData: AirAgentRequestData,
): AirExternalMcpArguments => {
    return airExternalMcpArgumentsSchema.parse({
        farmCode: defaultFarmCode,
        units: requestData.data.units ?? requestData.metadata.units ?? 'metric',
        lang: requestData.data.lang ?? requestData.metadata.lang ?? 'pt_br',
    });
};
