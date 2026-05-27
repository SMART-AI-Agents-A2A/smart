import { describe, expect, test } from 'vite-plus/test';
import { A2AError, a2aErrorCodes, toA2AError } from './a2a.errors';

describe('A2AError', () => {
    test('serializes to JSON-RPC error format', () => {
        const error = new A2AError(a2aErrorCodes.invalidParams, 'Params invalidos.');
        const jsonRpc = error.toJsonRpcError();

        expect(jsonRpc.code).toBe(a2aErrorCodes.invalidParams);
        expect(jsonRpc.message).toBe('Params invalidos.');
        expect(jsonRpc.data).toBeUndefined();
    });

    test('includes data when provided', () => {
        const error = new A2AError(a2aErrorCodes.internalError, 'Erro interno.', {
            field: 'group',
        });
        const jsonRpc = error.toJsonRpcError();

        expect(jsonRpc.data).toEqual({ field: 'group' });
    });
});

describe('toA2AError', () => {
    test('passes through an existing A2AError unchanged', () => {
        const original = new A2AError(a2aErrorCodes.parseError, 'JSON invalido.');
        const result = toA2AError(original);

        expect(result).toBe(original);
    });

    test('wraps a generic Error as internalError', () => {
        const generic = new Error('something broke');
        const result = toA2AError(generic);

        expect(result.toJsonRpcError().code).toBe(a2aErrorCodes.internalError);
        expect(result.toJsonRpcError().message).toContain('something broke');
    });

    test('wraps a non-Error value as internalError', () => {
        const result = toA2AError('string error');

        expect(result.toJsonRpcError().code).toBe(a2aErrorCodes.internalError);
    });
});
