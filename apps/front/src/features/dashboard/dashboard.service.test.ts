import { describe, expect, test } from 'vite-plus/test';
import { toDashboardMessages } from './dashboard.service';
import { initialMessages } from './dashboard.constants';
import type { OrchestratorTrace, StoredChatMessage } from './dashboard.type';

const directTrace: OrchestratorTrace = {
    thinking: ['Consultei o RAG da Cloudflare antes de responder.', 'Rota direta definida.'],
    route: 'direct',
    selectedAgent: null,
    agentCall: {
        called: false,
        agentId: null,
        agentName: null,
        action: null,
        status: 'skipped',
        summary: 'Resposta direta pelo orquestrador.',
    },
    references: [],
};

const agentTrace: OrchestratorTrace = {
    thinking: ['Acionei o agente Chuva.'],
    route: 'agent',
    selectedAgent: 'chuva',
    agentCall: {
        called: true,
        agentId: 'chuva',
        agentName: 'Chuva',
        action: 'consultar_chuva',
        status: 'completed',
        summary: 'Chuva acumulada coletada.',
    },
    references: [{ key: 'doc/chuva.md', score: 0.42 }],
};

describe('toDashboardMessages', () => {
    test('returns the initial messages when history is empty', () => {
        expect(toDashboardMessages([])).toBe(initialMessages);
    });

    test('reconstructs a trace block before an assistant message that stored a trace', () => {
        const stored: Array<StoredChatMessage> = [
            { role: 'user', content: 'Qual a chuva?' },
            {
                role: 'assistant',
                content: 'Choveu 10mm.',
                trace: { thinking: ['Live status step.'], trace: agentTrace },
            },
        ];

        const result = toDashboardMessages(stored);

        expect(result.map((message) => message.role)).toEqual(['user', 'trace', 'assistant']);

        const traceMessage = result[1];
        expect(traceMessage.role).toBe('trace');
        if (traceMessage.role === 'trace') {
            expect(traceMessage.thinking).toEqual(['Live status step.']);
            expect(traceMessage.trace).toEqual(agentTrace);
            expect(traceMessage.activePhase).toBeNull();
            expect(traceMessage.agentId).toBe('chuva');
            expect(traceMessage.agentName).toBe('Chuva');
        }
    });

    test('does not add a trace block for assistant messages without a stored trace', () => {
        const stored: Array<StoredChatMessage> = [
            { role: 'user', content: 'Oi' },
            { role: 'assistant', content: 'Ola' },
        ];

        expect(toDashboardMessages(stored).map((message) => message.role)).toEqual([
            'user',
            'assistant',
        ]);
    });

    test('assigns a unique id to every reconstructed message', () => {
        const stored: Array<StoredChatMessage> = [
            { role: 'user', content: 'Q1' },
            { role: 'assistant', content: 'A1', trace: { thinking: [], trace: directTrace } },
            { role: 'user', content: 'Q2' },
            { role: 'assistant', content: 'A2', trace: { thinking: [], trace: agentTrace } },
        ];

        const ids = toDashboardMessages(stored).map((message) => message.id);

        expect(new Set(ids).size).toBe(ids.length);
    });
});
