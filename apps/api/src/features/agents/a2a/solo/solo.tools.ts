import { z } from 'zod';
import { defaultFarmCode, fluxDurationSchema, fluxTimeSchema } from '../../tools/influxdb';
import type { MessageSendParams } from '../core';

export const soilAgentGroupSchema = z.enum([
    'Umidade do Solo',
    'Temperatura do Solo',
    'Condutividade Elétrica',
]);
export type SoilAgentGroup = z.infer<typeof soilAgentGroupSchema>;

export const soilAgentPointLimitSchema = z.union([
    z.literal('all'),
    z.number().int().min(1).max(500),
]);
export type SoilAgentPointLimit = z.infer<typeof soilAgentPointLimitSchema>;

export const soilAgentMetadataSchema = z
    .object({
        farmCode: z.literal(defaultFarmCode).optional(),
        group: soilAgentGroupSchema.optional(),
        start: fluxTimeSchema.optional(),
        stop: fluxTimeSchema.optional(),
        every: fluxDurationSchema.optional(),
        pointLimit: soilAgentPointLimitSchema.optional(),
    })
    .passthrough();
export type SoilAgentMetadata = z.infer<typeof soilAgentMetadataSchema>;

export const soilAgentDataPartSchema = z
    .object({
        farmCode: z.literal(defaultFarmCode).optional(),
        group: soilAgentGroupSchema.optional(),
        start: fluxTimeSchema.optional(),
        stop: fluxTimeSchema.optional(),
        every: fluxDurationSchema.optional(),
        pointLimit: soilAgentPointLimitSchema.optional(),
    })
    .passthrough();
export type SoilAgentDataPart = z.infer<typeof soilAgentDataPartSchema>;

export const soilAgentMcpArgumentsSchema = z.object({
    farmCode: z.literal(defaultFarmCode),
    group: soilAgentGroupSchema,
    start: fluxTimeSchema,
    stop: fluxTimeSchema.optional(),
    every: fluxDurationSchema,
});
export type SoilAgentMcpArguments = z.infer<typeof soilAgentMcpArgumentsSchema>;

export interface SoilAgentRequestData {
    readonly metadata: SoilAgentMetadata;
    readonly data: SoilAgentDataPart;
}

export const extractSoilAgentRequestData = (params: MessageSendParams): SoilAgentRequestData => {
    const metadata = soilAgentMetadataSchema.parse(params.metadata);
    const dataPart = params.message.parts.find((part) => part.kind === 'data');
    const data = soilAgentDataPartSchema.parse(dataPart?.data ?? {});

    return {
        metadata,
        data,
    };
};

export const createSoilMcpArguments = (
    requestData: SoilAgentRequestData,
): SoilAgentMcpArguments | null => {
    const group = requestData.data.group ?? requestData.metadata.group;

    if (!group) {
        return null;
    }

    return soilAgentMcpArgumentsSchema.parse({
        farmCode: defaultFarmCode,
        group,
        start: requestData.data.start ?? requestData.metadata.start ?? '-6h',
        stop: requestData.data.stop ?? requestData.metadata.stop,
        every: requestData.data.every ?? requestData.metadata.every ?? '20m',
    });
};
