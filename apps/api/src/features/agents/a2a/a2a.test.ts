import { describe, expect, test } from 'vite-plus/test';
import { a2aAgentCards } from './a2a.cards';
import { a2aRoutes } from './a2a.routes';
import { agentCardSchema, messageSendResponseSchema } from './core';

describe('A2A base routes', () => {
    test('exposes valid Agent Cards for SMA-11 agents', async () => {
        for (const path of [
            '/orchestrator/.well-known/agent-card.json',
            '/agents/solo/.well-known/agent-card.json',
            '/agents/chuva/.well-known/agent-card.json',
        ]) {
            const response = await a2aRoutes.request(path);
            const parsed = agentCardSchema.parse(await response.json());

            expect(response.status).toBe(200);
            expect(parsed.metadata.farmCode).toBe('Faz_NSAAB');
        }
    });

    test('handles message/send with a completed JSON-RPC task', async () => {
        const response = await a2aRoutes.request('/agents/solo', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'test-message-send',
                method: 'message/send',
                params: {
                    message: {
                        messageId: 'message-1',
                        role: 'user',
                        parts: [
                            {
                                kind: 'text',
                                text: 'Como está a umidade do solo?',
                            },
                        ],
                    },
                },
            }),
        });
        const parsed = messageSendResponseSchema.parse(await response.json());

        expect(response.status).toBe(200);
        expect(parsed.id).toBe('test-message-send');
        expect('status' in parsed.result).toBe(true);

        if ('status' in parsed.result) {
            expect(parsed.result.status.state).toBe('completed');
            expect(parsed.result.metadata.agent).toBe('solo');
        }
    });

    test('keeps cards available as typed module exports', () => {
        expect(a2aAgentCards.orchestrator.metadata.farmCode).toBe('Faz_NSAAB');
        expect(a2aAgentCards.soil.url).toBe('/v1/a2a/agents/solo');
        expect(a2aAgentCards.rain.url).toBe('/v1/a2a/agents/chuva');
    });
});
