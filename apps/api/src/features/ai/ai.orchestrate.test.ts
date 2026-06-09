import { describe, expect, test } from 'vite-plus/test';
import { processUpstreamBlock } from './ai.stream';
import { mergeStoredAssistantTraces } from './ai.history';
import type { OrchestratorTrace, StoredAssistantTrace, StoredChatMessage } from './ai.type';

function traceFor(label: string): StoredAssistantTrace {
    const trace: OrchestratorTrace = {
        thinking: [`Thinking de ${label}.`],
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

    return { thinking: [`Live de ${label}.`], trace };
}

function collect(block: string) {
    const deltas: Array<string> = [];
    const done = processUpstreamBlock(block, (text) => deltas.push(text));
    return { deltas, done };
}

describe('processUpstreamBlock', () => {
    test('ignores OpenRouter keepalive comment blocks (": OPENROUTER PROCESSING")', () => {
        const { deltas, done } = collect(': OPENROUTER PROCESSING');
        expect(deltas).toEqual([]);
        expect(done).toBe(false);
    });

    test('ignores blocks made only of comment lines', () => {
        const { deltas } = collect(': OPENROUTER PROCESSING\n: OPENROUTER PROCESSING');
        expect(deltas).toEqual([]);
    });

    test('emits the content of a data delta', () => {
        const { deltas, done } = collect('data: {"choices":[{"delta":{"content":"Oi"}}]}');
        expect(deltas).toEqual(['Oi']);
        expect(done).toBe(false);
    });

    test('detects the [DONE] sentinel without emitting text', () => {
        const { deltas, done } = collect('data: [DONE]');
        expect(deltas).toEqual([]);
        expect(done).toBe(true);
    });

    test('keeps content and drops a leading comment in a mixed block', () => {
        const { deltas } = collect(
            ': OPENROUTER PROCESSING\ndata: {"choices":[{"delta":{"content":"ok"}}]}',
        );
        expect(deltas).toEqual(['ok']);
    });
});

describe('mergeStoredAssistantTraces', () => {
    test('restores traces on prior assistant messages that arrived without one', () => {
        const a1 = traceFor('A1');
        const previous: Array<StoredChatMessage> = [
            { role: 'user', content: 'U1' },
            { role: 'assistant', content: 'A1', trace: a1 },
        ];
        // Frontend resends the full history (no traces) plus the new turn.
        const a2 = traceFor('A2');
        const next: Array<StoredChatMessage> = [
            { role: 'user', content: 'U1' },
            { role: 'assistant', content: 'A1' },
            { role: 'user', content: 'U2' },
            { role: 'assistant', content: 'A2', trace: a2 },
        ];

        const merged = mergeStoredAssistantTraces(previous, next);

        expect(merged[1].trace).toEqual(a1);
        expect(merged[3].trace).toEqual(a2);
        expect(
            merged.filter((message) => message.role === 'assistant' && message.trace),
        ).toHaveLength(2);
    });

    test('does not overwrite a trace already present on the incoming message', () => {
        const original = traceFor('original');
        const incoming = traceFor('incoming');
        const previous: Array<StoredChatMessage> = [
            { role: 'assistant', content: 'A1', trace: original },
        ];
        const next: Array<StoredChatMessage> = [
            { role: 'assistant', content: 'A1', trace: incoming },
        ];

        const merged = mergeStoredAssistantTraces(previous, next);

        expect(merged[0].trace).toEqual(incoming);
    });

    test('leaves assistant messages without any known trace untouched', () => {
        const next: Array<StoredChatMessage> = [
            { role: 'user', content: 'U1' },
            { role: 'assistant', content: 'A1' },
        ];

        const merged = mergeStoredAssistantTraces([], next);

        expect(merged[1].trace).toBeUndefined();
    });
});
