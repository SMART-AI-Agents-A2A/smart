import { z } from 'zod';
import { defaultFarmCode } from '../influxdb/influxdb.vo';

export const orquestradorTargetAgentSchema = z.enum([
    'solo',
    'chuva',
    'radiacao',
    'raio',
    'ar',
    'vento',
]);
export type OrquestradorTargetAgent = z.infer<typeof orquestradorTargetAgentSchema>;

export const orquestradorAvailableAgents = orquestradorTargetAgentSchema.options;

export const orquestradorIntentSchema = z.enum([...orquestradorAvailableAgents, 'unknown']);
export type OrquestradorIntent = z.infer<typeof orquestradorIntentSchema>;

export const orquestradorFarmCodeSchema = z.literal(defaultFarmCode);
export type OrquestradorFarmCode = z.infer<typeof orquestradorFarmCodeSchema>;

export const orquestradorChatRequestSchema = z.object({
    message: z.string().min(1),
    farmCode: orquestradorFarmCodeSchema.default(defaultFarmCode),
    targetAgent: orquestradorTargetAgentSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
});
export type OrquestradorChatRequest = z.infer<typeof orquestradorChatRequestSchema>;

export const orquestradorDelegationSchema = z.object({
    targetAgent: orquestradorTargetAgentSchema,
    reason: z.string().min(1),
    agentCardUrl: z.string().min(1),
    skillIds: z.array(z.string().min(1)).default([]),
});
export type OrquestradorDelegation = z.infer<typeof orquestradorDelegationSchema>;

export const orquestradorRoutingDecisionSchema = z.object({
    intent: orquestradorIntentSchema,
    delegation: orquestradorDelegationSchema.optional(),
});
export type OrquestradorRoutingDecision = z.infer<typeof orquestradorRoutingDecisionSchema>;

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
    availableAgents: z.array(orquestradorTargetAgentSchema).default(orquestradorAvailableAgents),
});
export type OrquestradorContext = z.infer<typeof orquestradorContextSchema>;

export const defaultOrquestradorContext: OrquestradorContext = {
    farmCode: defaultFarmCode,
    availableAgents: orquestradorAvailableAgents,
};

export class OrquestradorValueObject {
    static createSafeChatRequest(
        data: unknown,
    ): ReturnType<typeof orquestradorChatRequestSchema.safeParse> {
        return orquestradorChatRequestSchema.safeParse(data);
    }
}
