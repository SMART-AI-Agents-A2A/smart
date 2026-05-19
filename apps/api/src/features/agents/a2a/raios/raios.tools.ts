import { z } from 'zod';
import { defaultFarmCode, fluxDurationSchema, fluxTimeSchema } from '../../tools/influxdb';
import type { MessageSendParams } from '../core';

export const lightningAgentMetricSchema = z.enum(['incidence', 'strikes', 'risk']);
export type LightningAgentMetric = z.infer<typeof lightningAgentMetricSchema>;

export const lightningAgentPointLimitSchema = z.union([
    z.literal('all'),
    z.number().int().min(1).max(500),
]);
export type LightningAgentPointLimit = z.infer<typeof lightningAgentPointLimitSchema>;

export const lightningAgentMetadataSchema = z
    .object({
        farmCode: z.literal(defaultFarmCode).optional(),
        metric: lightningAgentMetricSchema.optional(),
        start: fluxTimeSchema.optional(),
        stop: fluxTimeSchema.optional(),
        every: fluxDurationSchema.optional(),
        pointLimit: lightningAgentPointLimitSchema.optional(),
    })
    .passthrough();
export type LightningAgentMetadata = z.infer<typeof lightningAgentMetadataSchema>;

export const lightningAgentDataPartSchema = lightningAgentMetadataSchema;
export type LightningAgentDataPart = z.infer<typeof lightningAgentDataPartSchema>;

export const lightningAgentMcpArgumentsSchema = z.object({
    farmCode: z.literal(defaultFarmCode),
    start: fluxTimeSchema,
    stop: fluxTimeSchema.optional(),
    every: fluxDurationSchema,
});
export type LightningAgentMcpArguments = z.infer<typeof lightningAgentMcpArgumentsSchema>;

export interface LightningAgentRequestData {
    readonly metadata: LightningAgentMetadata;
    readonly data: LightningAgentDataPart;
}

export const mcpToolByLightningMetric: Record<LightningAgentMetric, string> = {
    incidence: 'smart_lightning_incidence',
    strikes: 'smart_lightning_strikes',
    risk: 'smart_lightning_risk',
};

export const lightningMetricLabel: Record<LightningAgentMetric, string> = {
    incidence: 'incidência de raios',
    strikes: 'descargas atmosféricas',
    risk: 'risco elétrico por raios',
};

export const extractLightningAgentRequestData = (
    params: MessageSendParams,
): LightningAgentRequestData => {
    const metadata = lightningAgentMetadataSchema.parse(params.metadata);
    const dataPart = params.message.parts.find((part) => part.kind === 'data');
    const data = lightningAgentDataPartSchema.parse(dataPart?.data ?? {});

    return {
        metadata,
        data,
    };
};

export const getLightningAgentMetric = (
    requestData: LightningAgentRequestData,
): LightningAgentMetric => {
    return requestData.data.metric ?? requestData.metadata.metric ?? 'incidence';
};

export const createLightningMcpArguments = (
    requestData: LightningAgentRequestData,
): LightningAgentMcpArguments => {
    return lightningAgentMcpArgumentsSchema.parse({
        farmCode: defaultFarmCode,
        start: requestData.data.start ?? requestData.metadata.start ?? '-6h',
        stop: requestData.data.stop ?? requestData.metadata.stop,
        every: requestData.data.every ?? requestData.metadata.every ?? '20m',
    });
};

export const getLightningPointLimit = (
    requestData: LightningAgentRequestData,
): LightningAgentPointLimit | undefined =>
    requestData.data.pointLimit ?? requestData.metadata.pointLimit;
