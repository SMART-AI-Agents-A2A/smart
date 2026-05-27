import { z } from 'zod';

export const mcpJsonRpcVersionSchema = z.literal('2.0');

export const mcpRequestIdSchema = z.union([z.string().min(1), z.number().int(), z.null()]);
export type McpRequestId = z.infer<typeof mcpRequestIdSchema>;

export const mcpToolContentSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('text'),
        text: z.string(),
    }),
    z.object({
        type: z.literal('json'),
        data: z.unknown(),
    }),
]);
export type McpToolContent = z.infer<typeof mcpToolContentSchema>;

export const mcpToolSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    inputSchema: z.record(z.string(), z.unknown()),
    annotations: z.record(z.string(), z.unknown()).default({}),
});
export type McpTool = z.infer<typeof mcpToolSchema>;
export type McpToolJsonSchema = McpTool['inputSchema'];

export const mcpToolCallResultSchema = z.object({
    content: z.array(mcpToolContentSchema),
    structuredContent: z.unknown().optional(),
    isError: z.boolean().optional(),
});
export type McpToolCallResult = z.infer<typeof mcpToolCallResultSchema>;

export const mcpToolsListResultSchema = z.object({
    tools: z.array(mcpToolSchema),
});
export type McpToolsListResult = z.infer<typeof mcpToolsListResultSchema>;

export const mcpToolsCallParamsSchema = z.object({
    name: z.string().min(1),
    arguments: z.record(z.string(), z.unknown()).default({}),
});
export type McpToolsCallParams = z.infer<typeof mcpToolsCallParamsSchema>;

export const mcpJsonRpcRequestSchema = z.object({
    jsonrpc: mcpJsonRpcVersionSchema,
    id: mcpRequestIdSchema.optional(),
    method: z.string().min(1),
    params: z.unknown().optional(),
});
export type McpJsonRpcRequest = z.infer<typeof mcpJsonRpcRequestSchema>;

export const mcpJsonRpcErrorSchema = z.object({
    code: z.number().int(),
    message: z.string().min(1),
    data: z.unknown().optional(),
});
export type McpJsonRpcError = z.infer<typeof mcpJsonRpcErrorSchema>;

export const mcpJsonRpcSuccessResponseSchema = z.object({
    jsonrpc: mcpJsonRpcVersionSchema,
    id: mcpRequestIdSchema.optional(),
    result: z.unknown(),
});
export type McpJsonRpcSuccessResponse = z.infer<typeof mcpJsonRpcSuccessResponseSchema>;

export const mcpJsonRpcErrorResponseSchema = z.object({
    jsonrpc: mcpJsonRpcVersionSchema,
    id: mcpRequestIdSchema.optional(),
    error: mcpJsonRpcErrorSchema,
});
export type McpJsonRpcErrorResponse = z.infer<typeof mcpJsonRpcErrorResponseSchema>;

export const mcpJsonRpcResponseSchema = z.union([
    mcpJsonRpcSuccessResponseSchema,
    mcpJsonRpcErrorResponseSchema,
]);
export type McpJsonRpcResponse = z.infer<typeof mcpJsonRpcResponseSchema>;

export class McpValueObject {
    static createSafeJsonRpcRequest(
        data: unknown,
    ): ReturnType<typeof mcpJsonRpcRequestSchema.safeParse> {
        return mcpJsonRpcRequestSchema.safeParse(data);
    }

    static createToolsCallParams(data: unknown): McpToolsCallParams {
        return mcpToolsCallParamsSchema.parse(data);
    }

    static createToolCallResult(data: unknown): McpToolCallResult {
        return mcpToolCallResultSchema.parse(data);
    }
}
