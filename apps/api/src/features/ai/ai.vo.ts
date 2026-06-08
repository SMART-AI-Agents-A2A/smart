import { z } from 'zod';
import { AI_MODEL_IDS } from './ai.models';

export const AiChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1),
});

export const AiModelIdSchema = z.enum(AI_MODEL_IDS);

export const AiChatInboundSchema = z.object({
    messages: z.array(AiChatMessageSchema).min(1),
    conversationId: z.string().min(1).optional(),
    model: AiModelIdSchema.optional(),
});

export type AiChatMessage = z.infer<typeof AiChatMessageSchema>;
export type AiChatInbound = z.infer<typeof AiChatInboundSchema>;

export class AiValueObject {
    static createSafeChatInbound(data: unknown): ReturnType<typeof AiChatInboundSchema.safeParse> {
        return AiChatInboundSchema.safeParse(data);
    }
}
