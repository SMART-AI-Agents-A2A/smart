import { z } from 'zod';
import { defaultFarmCode, fluxDurationSchema, fluxTimeSchema } from '../../tools/influxdb';
import type { MessageSendParams } from '../core';

export const windAgentMetricSchema = z.enum(['speed', 'direction', 'gust']);
export type WindAgentMetric = z.infer<typeof windAgentMetricSchema>;

export const windAgentPointLimitSchema = z.union([
    z.literal('all'),
    z.number().int().min(1).max(500),
]);
export type WindAgentPointLimit = z.infer<typeof windAgentPointLimitSchema>;

export const windAgentMetadataSchema = z
    .object({
        farmCode: z.literal(defaultFarmCode).optional(),
        metric: windAgentMetricSchema.optional(),
        start: fluxTimeSchema.optional(),
        stop: fluxTimeSchema.optional(),
        every: fluxDurationSchema.optional(),
        pointLimit: windAgentPointLimitSchema.optional(),
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

export interface WindAgentRequestData {
    readonly metadata: WindAgentMetadata;
    readonly data: WindAgentDataPart;
}

export const mcpToolByWindMetric: Record<WindAgentMetric, string> = {
    speed: 'smart_wind_speed',
    direction: 'smart_wind_direction',
    gust: 'smart_wind_gust',
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
