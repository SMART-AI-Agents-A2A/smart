import { agentNames, apiOrigin } from './dashboard.constants';
import type {
    DashboardMessage,
    OrchestratorStatus,
    PrimaryAiChatInbound,
    PrimaryAiDoneEvent,
    PrimaryAiEventHandlers,
    PrimaryAiStartEvent,
    OrchestratorTrace,
} from './dashboard.type';

function parseSseEvent(block: string): { event: string; data: string } | null {
    const lines = block.split(/\r?\n/);
    let event = 'message';
    const dataLines: Array<string> = [];

    for (const line of lines) {
        if (line.startsWith('event:')) {
            event = line.slice(6).trim();
            continue;
        }

        if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart());
        }
    }

    if (dataLines.length === 0) {
        return null;
    }

    return {
        event,
        data: dataLines.join('\n'),
    };
}

function getErrorMessage(text: string) {
    try {
        const payload = JSON.parse(text);
        if (
            payload &&
            typeof payload === 'object' &&
            'message' in payload &&
            typeof payload.message === 'string'
        ) {
            return payload.message;
        }
    } catch {}

    return text || 'Falha ao chamar o endpoint de IA.';
}

function parseJsonData<T>(data: string): T | null {
    try {
        return JSON.parse(data) as T;
    } catch {
        return null;
    }
}

function processParsedEvent(
    parsedEvent: { event: string; data: string },
    handlers: PrimaryAiEventHandlers,
) {
    if (parsedEvent.data === '[DONE]') {
        return true;
    }

    if (parsedEvent.event === 'start') {
        const startEvent = parseJsonData<PrimaryAiStartEvent>(parsedEvent.data);
        if (startEvent) {
            handlers.onStart?.(startEvent);
        }
        return false;
    }

    if (parsedEvent.event === 'delta') {
        const deltaEvent = parseJsonData<{ delta?: string }>(parsedEvent.data);
        if (deltaEvent?.delta) {
            handlers.onDelta?.(deltaEvent.delta);
        }
        return false;
    }

    if (parsedEvent.event === 'trace') {
        const traceEvent = parseJsonData<OrchestratorTrace>(parsedEvent.data);
        if (traceEvent) {
            handlers.onTrace?.(traceEvent);
        }
        return false;
    }

    if (parsedEvent.event === 'done') {
        const doneEvent = parseJsonData<PrimaryAiDoneEvent>(parsedEvent.data);
        if (doneEvent) {
            handlers.onDone?.(doneEvent);
        }
        return true;
    }

    if (parsedEvent.event === 'error') {
        const errorPayload = parseJsonData<{ message?: string }>(parsedEvent.data);
        throw new Error(errorPayload?.message ?? 'Erro ao processar resposta da IA.');
    }

    return false;
}

export async function streamPrimaryAiChat(
    payload: PrimaryAiChatInbound,
    handlers: PrimaryAiEventHandlers,
) {
    const response = await fetch(`${apiOrigin}/v1/ai/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(getErrorMessage(text));
    }

    if (!response.body) {
        throw new Error('Resposta da IA sem stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            while (true) {
                const boundary = buffer.indexOf('\n\n');
                if (boundary === -1) {
                    break;
                }

                const block = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);

                const parsedEvent = parseSseEvent(block);
                if (!parsedEvent) {
                    continue;
                }

                if (processParsedEvent(parsedEvent, handlers)) {
                    return;
                }
            }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
            const parsedEvent = parseSseEvent(buffer);
            if (parsedEvent) {
                processParsedEvent(parsedEvent, handlers);
            }
        }
    } finally {
        reader.releaseLock();
    }
}

export function getAgentName(agentId: string | null) {
    if (!agentId) {
        return null;
    }

    return agentNames[agentId] ?? agentId;
}

export function getRouteLabel(status: OrchestratorStatus) {
    const agentName = getAgentName(status.selectedAgent);
    if (agentName) {
        return `Encaminhado para ${agentName}`;
    }

    if (status.route === 'direct') {
        return 'Resposta direta';
    }

    return 'Aguardando pergunta';
}

export function getRagLabel(status: OrchestratorStatus) {
    if (status.ragEnabled) {
        return `${status.sourceCount} fonte${status.sourceCount === 1 ? '' : 's'} RAG`;
    }

    return 'RAG sem contexto';
}

export function applyDoneMetadata(
    event: PrimaryAiDoneEvent,
    message: DashboardMessage,
): DashboardMessage {
    if (message.role === 'trace') {
        return message;
    }

    const agentName = event.agentResult?.agentName ?? getAgentName(event.selectedAgent);

    return {
        ...message,
        agentName,
        text: message.text || event.response,
    };
}

export function isChatMessage(
    message: DashboardMessage,
): message is Extract<DashboardMessage, { role: 'assistant' | 'user' }> {
    return message.role !== 'trace';
}

export function formatScore(score: number) {
    return score.toFixed(3);
}
