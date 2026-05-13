import { z } from 'zod';
import { defaultFarmCode } from '../tools/influxdb/influxdb.types';

export const orquestradorIntentSchema = z.enum(['solo', 'chuva', 'unknown']);
export type OrquestradorIntent = z.infer<typeof orquestradorIntentSchema>;

export const orquestradorFarmCodeSchema = z.literal(defaultFarmCode);
export type OrquestradorFarmCode = z.infer<typeof orquestradorFarmCodeSchema>;

export const orquestradorChatRequestSchema = z.object({
    message: z.string().min(1),
    farmCode: orquestradorFarmCodeSchema.default(defaultFarmCode),
    metadata: z.record(z.string(), z.unknown()).default({}),
});
export type OrquestradorChatRequest = z.infer<typeof orquestradorChatRequestSchema>;

export const orquestradorTargetAgentSchema = z.enum(['solo', 'chuva']);
export type OrquestradorTargetAgent = z.infer<typeof orquestradorTargetAgentSchema>;

export const orquestradorDelegationSchema = z.object({
    targetAgent: orquestradorTargetAgentSchema,
    reason: z.string().min(1),
});
export type OrquestradorDelegation = z.infer<typeof orquestradorDelegationSchema>;

export const orquestradorChatResponseSchema = z.object({
    requestId: z.string().min(1),
    farmCode: orquestradorFarmCodeSchema,
    intent: orquestradorIntentSchema,
    answer: z.string().min(1),
    delegation: orquestradorDelegationSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
});
export type OrquestradorChatResponse = z.infer<typeof orquestradorChatResponseSchema>;

export const orquestradorContextSchema = z.object({
    farmCode: orquestradorFarmCodeSchema.default(defaultFarmCode),
    availableAgents: z.array(orquestradorTargetAgentSchema).default(['solo', 'chuva']),
});
export type OrquestradorContext = z.infer<typeof orquestradorContextSchema>;

export const defaultOrquestradorContext: OrquestradorContext = {
    farmCode: defaultFarmCode,
    availableAgents: ['solo', 'chuva'],
};
