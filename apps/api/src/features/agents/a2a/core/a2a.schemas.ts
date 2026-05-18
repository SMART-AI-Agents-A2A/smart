import { z } from 'zod';

export const a2aJsonRpcVersionSchema = z.literal('2.0');

export const a2aRequestIdSchema = z.union([z.string().min(1), z.number().int(), z.null()]);

export const agentSkillSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string().min(1)).default([]),
    examples: z.array(z.string().min(1)).optional(),
    inputModes: z.array(z.string().min(1)).default(['text/plain']),
    outputModes: z.array(z.string().min(1)).default(['text/plain']),
});
export type AgentSkill = z.infer<typeof agentSkillSchema>;

export const agentCardSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    url: z.string().min(1),
    version: z.string().min(1),
    protocolVersion: z.string().min(1).default('0.2.0'),
    defaultInputModes: z.array(z.string().min(1)).default(['text/plain']),
    defaultOutputModes: z.array(z.string().min(1)).default(['text/plain']),
    capabilities: z
        .object({
            streaming: z.boolean().default(false),
            pushNotifications: z.boolean().default(false),
            stateTransitionHistory: z.boolean().default(false),
        })
        .default({
            streaming: false,
            pushNotifications: false,
            stateTransitionHistory: false,
        }),
    skills: z.array(agentSkillSchema).min(1),
    provider: z
        .object({
            organization: z.string().min(1),
            url: z.string().min(1).optional(),
        })
        .optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
});
export type AgentCard = z.infer<typeof agentCardSchema>;

const messagePartBaseSchema = z.object({
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export const textMessagePartSchema = messagePartBaseSchema.extend({
    kind: z.literal('text'),
    text: z.string().min(1),
});

export const dataMessagePartSchema = messagePartBaseSchema.extend({
    kind: z.literal('data'),
    data: z.record(z.string(), z.unknown()),
});

export const fileMessagePartSchema = messagePartBaseSchema.extend({
    kind: z.literal('file'),
    file: z.object({
        name: z.string().min(1).optional(),
        mimeType: z.string().min(1).optional(),
        bytes: z.string().min(1).optional(),
        uri: z.string().min(1).optional(),
    }),
});

export const messagePartSchema = z.discriminatedUnion('kind', [
    textMessagePartSchema,
    dataMessagePartSchema,
    fileMessagePartSchema,
]);
export type MessagePart = z.infer<typeof messagePartSchema>;

export const messageSchema = z.object({
    messageId: z.string().min(1),
    role: z.enum(['user', 'agent']),
    parts: z.array(messagePartSchema).min(1),
    metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Message = z.infer<typeof messageSchema>;

export const taskStatusStateSchema = z.enum([
    'submitted',
    'working',
    'input-required',
    'completed',
    'canceled',
    'failed',
    'rejected',
    'auth-required',
    'unknown',
]);
export type TaskStatusState = z.infer<typeof taskStatusStateSchema>;

export const taskStatusSchema = z.object({
    state: taskStatusStateSchema,
    message: messageSchema.optional(),
    timestamp: z.string().datetime().optional(),
});
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskSchema = z.object({
    id: z.string().min(1),
    contextId: z.string().min(1).optional(),
    status: taskStatusSchema,
    history: z.array(messageSchema).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Task = z.infer<typeof taskSchema>;

export const messageSendParamsSchema = z.object({
    message: messageSchema,
    configuration: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
});
export type MessageSendParams = z.infer<typeof messageSendParamsSchema>;

export const jsonRpcRequestSchema = z.object({
    jsonrpc: a2aJsonRpcVersionSchema,
    id: a2aRequestIdSchema.optional(),
    method: z.string().min(1),
    params: z.unknown().optional(),
});
export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;

export const jsonRpcErrorSchema = z.object({
    code: z.number().int(),
    message: z.string().min(1),
    data: z.unknown().optional(),
});
export type JsonRpcError = z.infer<typeof jsonRpcErrorSchema>;

export const jsonRpcSuccessResponseSchema = z.object({
    jsonrpc: a2aJsonRpcVersionSchema,
    id: a2aRequestIdSchema.optional(),
    result: z.unknown(),
});
export type JsonRpcSuccessResponse = z.infer<typeof jsonRpcSuccessResponseSchema>;

export const jsonRpcErrorResponseSchema = z.object({
    jsonrpc: a2aJsonRpcVersionSchema,
    id: a2aRequestIdSchema.optional(),
    error: jsonRpcErrorSchema,
});
export type JsonRpcErrorResponse = z.infer<typeof jsonRpcErrorResponseSchema>;

export const jsonRpcResponseSchema = z.union([
    jsonRpcSuccessResponseSchema,
    jsonRpcErrorResponseSchema,
]);
export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;

export const messageSendResponseSchema = jsonRpcSuccessResponseSchema.extend({
    result: z.union([taskSchema, messageSchema]),
});
export type MessageSendResponse = z.infer<typeof messageSendResponseSchema>;
