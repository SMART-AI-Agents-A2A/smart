import { describe, expect, test } from 'vite-plus/test';
import { A2AValueObject } from './a2a.vo';

describe('A2AValueObject.createSafeJsonRpcRequest', () => {
    test('accepts a valid message/send request', () => {
        const result = A2AValueObject.createSafeJsonRpcRequest({
            jsonrpc: '2.0',
            id: 'test-1',
            method: 'message/send',
            params: {
                message: {
                    messageId: 'msg-1',
                    role: 'user',
                    parts: [{ kind: 'text', text: 'hello' }],
                    metadata: {},
                },
            },
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.method).toBe('message/send');
            expect(result.data.id).toBe('test-1');
        }
    });

    test('rejects a request missing jsonrpc field', () => {
        const result = A2AValueObject.createSafeJsonRpcRequest({
            id: 'test-2',
            method: 'message/send',
        });

        expect(result.success).toBe(false);
    });

    test('rejects a request with wrong jsonrpc version', () => {
        const result = A2AValueObject.createSafeJsonRpcRequest({
            jsonrpc: '1.0',
            id: 'test-3',
            method: 'message/send',
        });

        expect(result.success).toBe(false);
    });
});

describe('A2AValueObject.createSafeMessageSendParams', () => {
    test('accepts params with text part', () => {
        const result = A2AValueObject.createSafeMessageSendParams({
            message: {
                messageId: 'msg-1',
                role: 'user',
                parts: [{ kind: 'text', text: 'dados de solo' }],
                metadata: {},
            },
        });

        expect(result.success).toBe(true);
    });

    test('accepts params with data part', () => {
        const result = A2AValueObject.createSafeMessageSendParams({
            message: {
                messageId: 'msg-2',
                role: 'user',
                parts: [
                    { kind: 'text', text: 'dados de solo' },
                    { kind: 'data', data: { group: 'Umidade do Solo' } },
                ],
                metadata: {},
            },
        });

        expect(result.success).toBe(true);
    });

    test('rejects params missing message', () => {
        const result = A2AValueObject.createSafeMessageSendParams({});
        expect(result.success).toBe(false);
    });

    test('rejects parts with unknown kind', () => {
        const result = A2AValueObject.createSafeMessageSendParams({
            message: {
                messageId: 'msg-3',
                role: 'user',
                parts: [{ kind: 'unknown', text: 'bad' }],
                metadata: {},
            },
        });

        expect(result.success).toBe(false);
    });
});

describe('A2AValueObject.createAgentCard', () => {
    test('accepts a valid agent card', () => {
        const card = A2AValueObject.createAgentCard({
            name: 'Test Agent',
            description: 'A test agent',
            url: '/v1/a2a/agents/test',
            version: '1.0.0',
            protocolVersion: '0.2.0',
            defaultInputModes: ['text/plain'],
            defaultOutputModes: ['text/plain'],
            capabilities: {
                streaming: false,
                pushNotifications: false,
                stateTransitionHistory: false,
            },
            skills: [
                {
                    id: 'test.skill',
                    name: 'Test Skill',
                    description: 'Does testing',
                    tags: ['test'],
                    inputModes: ['text/plain'],
                    outputModes: ['text/plain'],
                },
            ],
        });

        expect(card.name).toBe('Test Agent');
        expect(card.skills).toHaveLength(1);
    });
});
