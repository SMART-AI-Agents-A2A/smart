import { describe, expect, test } from 'vite-plus/test';
import { processUpstreamBlock } from './ai.stream';

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
