import { z } from 'zod';

export const AiChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1),
});

export const AiChatInboundSchema = z.object({
    messages: z.array(AiChatMessageSchema).min(1),
    conversationId: z.string().min(1).optional(),
});

export type AiChatMessage = z.infer<typeof AiChatMessageSchema>;
export type AiChatInbound = z.infer<typeof AiChatInboundSchema>;

export class AiValueObject {
    static createSafeChatInbound(data: unknown): ReturnType<typeof AiChatInboundSchema.safeParse> {
        return AiChatInboundSchema.safeParse(data);
    }
}
