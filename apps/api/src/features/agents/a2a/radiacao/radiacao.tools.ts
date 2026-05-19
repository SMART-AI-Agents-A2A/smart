import { z } from 'zod';
import { defaultFarmCode, fluxDurationSchema, fluxTimeSchema } from '../../tools/influxdb';
import type { MessageSendParams } from '../core';

export const radiationAgentPointLimitSchema = z.union([
    z.literal('all'),
    z.number().int().min(1).max(500),
]);
export type RadiationAgentPointLimit = z.infer<typeof radiationAgentPointLimitSchema>;

export const radiationAgentMetadataSchema = z
    .object({
        farmCode: z.literal(defaultFarmCode).optional(),
        start: fluxTimeSchema.optional(),
        stop: fluxTimeSchema.optional(),
        every: fluxDurationSchema.optional(),
        pointLimit: radiationAgentPointLimitSchema.optional(),
    })
    .passthrough();
export type RadiationAgentMetadata = z.infer<typeof radiationAgentMetadataSchema>;

export const radiationAgentDataPartSchema = radiationAgentMetadataSchema;
export type RadiationAgentDataPart = z.infer<typeof radiationAgentDataPartSchema>;

export const radiationSolarMcpArgumentsSchema = z.object({
    farmCode: z.literal(defaultFarmCode),
    start: fluxTimeSchema,
    stop: fluxTimeSchema.optional(),
    every: fluxDurationSchema,
});
export type RadiationSolarMcpArguments = z.infer<typeof radiationSolarMcpArgumentsSchema>;

export interface RadiationAgentRequestData {
    readonly metadata: RadiationAgentMetadata;
    readonly data: RadiationAgentDataPart;
}

export const extractRadiationAgentRequestData = (
    params: MessageSendParams,
): RadiationAgentRequestData => {
    const metadata = radiationAgentMetadataSchema.parse(params.metadata);
    const dataPart = params.message.parts.find((part) => part.kind === 'data');
    const data = radiationAgentDataPartSchema.parse(dataPart?.data ?? {});

    return {
        metadata,
        data,
    };
};

export const createRadiationSolarMcpArguments = (
    requestData: RadiationAgentRequestData,
): RadiationSolarMcpArguments => {
    return radiationSolarMcpArgumentsSchema.parse({
        farmCode: defaultFarmCode,
        start: requestData.data.start ?? requestData.metadata.start ?? '-6h',
        stop: requestData.data.stop ?? requestData.metadata.stop,
        every: requestData.data.every ?? requestData.metadata.every ?? '20m',
    });
};

export const getRadiationPointLimit = (
    requestData: RadiationAgentRequestData,
): RadiationAgentPointLimit | undefined =>
    requestData.data.pointLimit ?? requestData.metadata.pointLimit;
