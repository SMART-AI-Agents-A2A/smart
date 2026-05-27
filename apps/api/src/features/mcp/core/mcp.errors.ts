import type { McpJsonRpcError } from './mcp.type';

export const mcpErrorCodes = {
    parseError: -32700,
    invalidRequest: -32600,
    methodNotFound: -32601,
    invalidParams: -32602,
    internalError: -32603,
} as const;

export class McpError extends Error {
    readonly code: number;
    readonly data?: unknown;

    constructor(code: number, message: string, data?: unknown) {
        super(message);
        this.name = 'McpError';
        this.code = code;
        this.data = data;
    }

    toJsonRpcError(): McpJsonRpcError {
        return {
            code: this.code,
            message: this.message,
            data: this.data,
        };
    }
}

export const toMcpError = (error: unknown): McpError => {
    if (error instanceof McpError) {
        return error;
    }

    const message = error instanceof Error ? error.message : 'Erro interno no MCP Server.';

    return new McpError(mcpErrorCodes.internalError, message);
};
