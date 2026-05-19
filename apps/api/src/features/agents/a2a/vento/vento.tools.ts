import { z } from 'zod';
import { defaultFarmCode, fluxDurationSchema, fluxTimeSchema } from '../../tools/influxdb';
import {
    forecastCountFromQuerySchema,
    openWeatherQuerySchema,
    openWeatherUnitsSchema,
} from '../../tools/openweather';
import type { MessageSendParams } from '../core';

export const windAgentMetricSchema = z.enum(['speed', 'direction', 'gust']);
export type WindAgentMetric = z.infer<typeof windAgentMetricSchema>;

export const windAgentActionSchema = z.enum(['measured', 'current', 'forecast']);
export type WindAgentAction = z.infer<typeof windAgentActionSchema>;

export const windAgentSourceSchema = z.enum(['sensor', 'external']);
export type WindAgentSource = z.infer<typeof windAgentSourceSchema>;

export const windAgentPointLimitSchema = z.union([
    z.literal('all'),
    z.number().int().min(1).max(500),
]);
export type WindAgentPointLimit = z.infer<typeof windAgentPointLimitSchema>;

export const windAgentMetadataSchema = z
    .object({
        farmCode: z.literal(defaultFarmCode).optional(),
        metric: windAgentMetricSchema.optional(),
        action: windAgentActionSchema.optional(),
        source: windAgentSourceSchema.optional(),
        start: fluxTimeSchema.optional(),
        stop: fluxTimeSchema.optional(),
        every: fluxDurationSchema.optional(),
        units: openWeatherUnitsSchema.optional(),
        lang: z.string().min(2).max(8).optional(),
        cnt: forecastCountFromQuerySchema.optional(),
        pointLimit: windAgentPointLimitSchema.optional(),
        forecastLimit: windAgentPointLimitSchema.optional(),
    })
    .passthrough();
export type WindAgentMetadata = z.infer<typeof windAgentMetadataSchema>;

export const windAgentDataPartSchema = windAgentMetadataSchema;
export type WindAgentDataPart = z.infer<typeof windAgentDataPartSchema>;

export const windAgentMcpArgumentsSchema = z.object({
    farmCode: z.literal(defaultFarmCode),
    start: fluxTimeSchema,
    stop: fluxTimeSchema.optional(),
    every: fluxDurationSchema,
});
export type WindAgentMcpArguments = z.infer<typeof windAgentMcpArgumentsSchema>;

export const windExternalMcpArgumentsSchema = openWeatherQuerySchema.extend({
    farmCode: z.literal(defaultFarmCode),
});
export type WindExternalMcpArguments = z.infer<typeof windExternalMcpArgumentsSchema>;

export interface WindAgentRequestData {
    readonly metadata: WindAgentMetadata;
    readonly data: WindAgentDataPart;
}

export const mcpToolByWindMetric: Record<WindAgentMetric, string> = {
    speed: 'smart_wind_speed',
    direction: 'smart_wind_direction',
    gust: 'smart_wind_gust',
};

export const mcpToolByExternalWindAction: Record<Exclude<WindAgentAction, 'measured'>, string> = {
    current: 'smart_wind_current_weather',
    forecast: 'smart_wind_forecast',
};

export const windMetricLabel: Record<WindAgentMetric, string> = {
    speed: 'velocidade do vento',
    direction: 'direção do vento',
    gust: 'rajadas de vento',
};

export const extractWindAgentRequestData = (params: MessageSendParams): WindAgentRequestData => {
    const metadata = windAgentMetadataSchema.parse(params.metadata);
    const dataPart = params.message.parts.find((part) => part.kind === 'data');
    const data = windAgentDataPartSchema.parse(dataPart?.data ?? {});

    return {
        metadata,
        data,
    };
};

export const getWindAgentMetric = (requestData: WindAgentRequestData): WindAgentMetric => {
    return requestData.data.metric ?? requestData.metadata.metric ?? 'speed';
};

export const getWindAgentSource = (requestData: WindAgentRequestData): WindAgentSource => {
    const explicitSource = requestData.data.source ?? requestData.metadata.source;
    const action = requestData.data.action ?? requestData.metadata.action;

    if (explicitSource) return explicitSource;

    return action === 'current' || action === 'forecast' ? 'external' : 'sensor';
};

export const getWindAgentAction = (requestData: WindAgentRequestData): WindAgentAction => {
    const explicitAction = requestData.data.action ?? requestData.metadata.action;
    const source = requestData.data.source ?? requestData.metadata.source;

    if (explicitAction) return explicitAction;

    return source === 'external' ? 'current' : 'measured';
};

export const createWindMcpArguments = (
    requestData: WindAgentRequestData,
): WindAgentMcpArguments => {
    return windAgentMcpArgumentsSchema.parse({
        farmCode: defaultFarmCode,
        start: requestData.data.start ?? requestData.metadata.start ?? '-6h',
        stop: requestData.data.stop ?? requestData.metadata.stop,
        every: requestData.data.every ?? requestData.metadata.every ?? '20m',
    });
};

export const getWindPointLimit = (
    requestData: WindAgentRequestData,
): WindAgentPointLimit | undefined =>
    requestData.data.pointLimit ?? requestData.metadata.pointLimit;

export const getWindForecastLimit = (
    requestData: WindAgentRequestData,
): WindAgentPointLimit | undefined =>
    requestData.data.forecastLimit ??
    requestData.metadata.forecastLimit ??
    requestData.data.pointLimit ??
    requestData.metadata.pointLimit;

export const createWindExternalMcpArguments = (
    requestData: WindAgentRequestData,
): WindExternalMcpArguments => {
    return windExternalMcpArgumentsSchema.parse({
        farmCode: defaultFarmCode,
        units: requestData.data.units ?? requestData.metadata.units ?? 'metric',
        lang: requestData.data.lang ?? requestData.metadata.lang ?? 'pt_br',
        cnt: requestData.data.cnt ?? requestData.metadata.cnt,
    });
};
