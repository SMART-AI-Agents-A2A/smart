import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { McpError, mcpErrorCodes, toMcpError } from './mcp.errors';
import {
    mcpJsonRpcRequestSchema,
    mcpToolsCallParamsSchema,
    type McpJsonRpcRequest,
} from './mcp.schemas';
import type { McpToolRegistry } from './mcp.registry';

export interface CreateMcpServerOptions {
    readonly registry: McpToolRegistry;
}

const jsonRpcResponse = (id: McpJsonRpcRequest['id'], result: unknown) => ({
    jsonrpc: '2.0' as const,
    id,
    result,
});

const jsonRpcErrorResponse = (id: McpJsonRpcRequest['id'], error: McpError) => ({
    jsonrpc: '2.0' as const,
    id,
    error: error.toJsonRpcError(),
});

export const createMcpServer = ({ registry }: CreateMcpServerOptions) => {
    const router = new Hono<{ Bindings: CloudflareBindings }>();

    router.post('/', async (c) => {
        let payload: unknown;

        try {
            payload = await c.req.json();
        } catch {
            return c.json(
                jsonRpcErrorResponse(
                    null,
                    new McpError(mcpErrorCodes.parseError, 'JSON inválido.'),
                ),
                StatusCodes.BAD_REQUEST,
            );
        }

        const requestResult = mcpJsonRpcRequestSchema.safeParse(payload);

        if (!requestResult.success) {
            return c.json(
                jsonRpcErrorResponse(
                    null,
                    new McpError(
                        mcpErrorCodes.invalidRequest,
                        'Requisição JSON-RPC inválida para MCP.',
                        requestResult.error.issues,
                    ),
                ),
                StatusCodes.BAD_REQUEST,
            );
        }

        const request = requestResult.data;

        try {
            if (request.method === 'tools/list') {
                return c.json(
                    jsonRpcResponse(request.id, { tools: registry.listTools() }),
                    StatusCodes.OK,
                );
            }

            if (request.method === 'tools/call') {
                const params = mcpToolsCallParamsSchema.parse(request.params);
                const result = await registry.callTool(params.name, params.arguments, {
                    env: c.env,
                });

                return c.json(jsonRpcResponse(request.id, result), StatusCodes.OK);
            }

            return c.json(
                jsonRpcErrorResponse(
                    request.id,
                    new McpError(
                        mcpErrorCodes.methodNotFound,
                        `Método MCP não suportado: ${request.method}.`,
                    ),
                ),
                StatusCodes.OK,
            );
        } catch (error) {
            return c.json(jsonRpcErrorResponse(request.id, toMcpError(error)), StatusCodes.OK);
        }
    });

    return router;
};
