import { ZodError } from 'zod';
import type { JsonRpcError } from './a2a.schemas';

export const a2aErrorCodes = {
    parseError: -32700,
    invalidRequest: -32600,
    methodNotFound: -32601,
    invalidParams: -32602,
    internalError: -32603,
} as const;

export class A2AError extends Error {
    readonly code: number;
    readonly data?: unknown;

    constructor(code: number, message: string, data?: unknown) {
        super(message);
        this.name = 'A2AError';
        this.code = code;
        this.data = data;
    }

    toJsonRpcError(): JsonRpcError {
        return {
            code: this.code,
            message: this.message,
            data: this.data,
        };
    }
}

export const toA2AError = (error: unknown): A2AError => {
    if (error instanceof A2AError) {
        return error;
    }

    if (error instanceof ZodError) {
        return new A2AError(
            a2aErrorCodes.invalidParams,
            'Parâmetros inválidos para o agente A2A.',
            error.issues.map((issue) => ({
                path: issue.path.map(String).join('.') || 'root',
                message: issue.message,
            })),
        );
    }

    const message = error instanceof Error ? error.message : 'Erro interno no agente A2A.';

    return new A2AError(a2aErrorCodes.internalError, message);
};
