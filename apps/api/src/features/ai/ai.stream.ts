// Pure SSE/text stream helpers for the AI orchestrator. Kept dependency-free (type-only
// imports) so they can be unit-tested without loading the agent/MCP/InfluxDB runtime chain
// that ai.orchestrate.ts pulls in.
import type { AiStatusEvent, SseEventName } from './ai.type';

export function toSseEvent(event: SseEventName, payload: unknown) {
    return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export function toStatusEvent(status: AiStatusEvent) {
    return toSseEvent('status', status);
}

export function extractModelText(payload: unknown): string {
    if (typeof payload === 'string') {
        return payload;
    }

    if (!payload || typeof payload !== 'object') {
        return '';
    }

    if ('output_text' in payload && typeof payload.output_text === 'string') {
        return payload.output_text;
    }

    if ('response' in payload && typeof payload.response === 'string') {
        return payload.response;
    }

    if ('text' in payload && typeof payload.text === 'string') {
        return payload.text;
    }

    if ('choices' in payload && Array.isArray(payload.choices) && payload.choices.length > 0) {
        const firstChoice = payload.choices[0];
        if (!firstChoice || typeof firstChoice !== 'object') {
            return '';
        }

        if ('text' in firstChoice && typeof firstChoice.text === 'string') {
            return firstChoice.text;
        }

        if (
            'message' in firstChoice &&
            firstChoice.message &&
            typeof firstChoice.message === 'object' &&
            'content' in firstChoice.message &&
            typeof firstChoice.message.content === 'string'
        ) {
            return firstChoice.message.content;
        }
    }

    return '';
}

function extractDeltaText(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
        return typeof payload === 'string' ? payload : '';
    }

    const modelText = extractModelText(payload);
    if (modelText) {
        return modelText;
    }

    if ('delta' in payload && typeof payload.delta === 'string') {
        return payload.delta;
    }

    if ('choices' in payload && Array.isArray(payload.choices) && payload.choices.length > 0) {
        const firstChoice = payload.choices[0];
        if (!firstChoice || typeof firstChoice !== 'object') {
            return '';
        }

        if (
            'delta' in firstChoice &&
            firstChoice.delta &&
            typeof firstChoice.delta === 'object' &&
            'content' in firstChoice.delta &&
            typeof firstChoice.delta.content === 'string'
        ) {
            return firstChoice.delta.content;
        }
    }

    return '';
}

function parseSseDataBlock(block: string) {
    const lines = block.split(/\r?\n/);
    const dataLines = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) {
        return null;
    }

    return dataLines.join('\n');
}

export function processUpstreamBlock(block: string, onDelta: (text: string) => void): boolean {
    const normalized = block.trim();
    if (!normalized) {
        return false;
    }

    // SSE comment lines start with ":" and must be ignored (SSE spec). Providers send them
    // as keepalive/processing pings while the model is thinking — e.g. OpenRouter's
    // ": OPENROUTER PROCESSING". Without this guard the raw-text fallback below would leak
    // those pings into the streamed answer.
    if (normalized.split(/\r?\n/).every((line) => !line.trim() || line.startsWith(':'))) {
        return false;
    }

    const data = parseSseDataBlock(normalized);
    if (data === '[DONE]') {
        return true;
    }

    if (data) {
        try {
            const parsed = JSON.parse(data);
            const delta = extractDeltaText(parsed);
            if (delta) {
                onDelta(delta);
            }
            return false;
        } catch {
            onDelta(data);
            return false;
        }
    }

    try {
        const parsed = JSON.parse(normalized);
        const delta = extractDeltaText(parsed);
        if (delta) {
            onDelta(delta);
        }
        return false;
    } catch {
        onDelta(normalized);
        return false;
    }
}
