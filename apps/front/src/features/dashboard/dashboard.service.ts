import { agentNames, apiOrigin } from './dashboard.constants';
import type {
    AgentMessage,
    AgentExecutionResult,
    DashboardMessage,
    OrchestratorStatus,
    PrimaryAiChatInbound,
    PrimaryAiDoneEvent,
    PrimaryAiEventHandlers,
    PrimaryAiStartEvent,
    PrimaryAiStatusEvent,
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

    if (parsedEvent.event === 'status') {
        const statusEvent = parseJsonData<PrimaryAiStatusEvent>(parsedEvent.data);
        if (statusEvent) {
            handlers.onStatus?.(statusEvent);
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

function appendUnique(items: Array<string>, item: string) {
    const normalized = item.trim();
    if (!normalized || items.includes(normalized)) {
        return items;
    }

    return [...items, normalized];
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function padDatePart(value: number) {
    return String(value).padStart(2, '0');
}

function parseIsoTimestamp(value: string) {
    const parseable = value.replace(/(\.\d{3})\d+(Z|[+-]\d{2}:?\d{2})$/i, '$1$2');
    const parsed = new Date(parseable);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDatePartsForBrazil(parts: Intl.DateTimeFormatPart[]) {
    const byType = Object.fromEntries(
        parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
    );

    return `${byType.day}/${byType.month}/${byType.year} ${byType.hour}:${byType.minute}:${byType.second}`;
}

function formatTimestampForBrazil(value: string) {
    const parsed = parseIsoTimestamp(value);

    if (!parsed) return value;

    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        hourCycle: 'h23',
    }).formatToParts(parsed);

    return formatDatePartsForBrazil(parts);
}

function formatTimestampAsUtcClock(value: string) {
    const parsed = parseIsoTimestamp(value);

    if (!parsed) return null;

    return {
        dateTime:
            [
                padDatePart(parsed.getUTCDate()),
                padDatePart(parsed.getUTCMonth() + 1),
                parsed.getUTCFullYear(),
            ].join('/') +
            ` ${padDatePart(parsed.getUTCHours())}:${padDatePart(parsed.getUTCMinutes())}:${padDatePart(parsed.getUTCSeconds())}`,
        time: `${padDatePart(parsed.getUTCHours())}:${padDatePart(parsed.getUTCMinutes())}:${padDatePart(parsed.getUTCSeconds())}`,
    };
}

function timestampsFromAgentResults(agentResults: Array<AgentExecutionResult>) {
    return [
        ...new Set(
            agentResults.flatMap((result) => [
                ...(result.evidence?.latestTimestamp ? [result.evidence.latestTimestamp] : []),
                ...(result.evidence?.timestamps ?? []),
                ...(result.evidence?.values.flatMap((value) =>
                    value.timestamp ? [value.timestamp] : [],
                ) ?? []),
            ]),
        ),
    ];
}

function replaceKnownUtcClockDisplays(text: string, agentResults: Array<AgentExecutionResult>) {
    return timestampsFromAgentResults(agentResults).reduce((current, timestamp) => {
        const utcDisplay = formatTimestampAsUtcClock(timestamp);
        const brazilDisplay = formatTimestampForBrazil(timestamp);

        if (!utcDisplay || brazilDisplay === utcDisplay.dateTime) return current;

        return current
            .replaceAll(utcDisplay.dateTime, brazilDisplay)
            .replace(
                new RegExp(`\\(${escapeRegExp(utcDisplay.time)}\\)`, 'g'),
                `(${brazilDisplay.slice(11)})`,
            );
    }, text);
}

function formatNumbersForBrazil(text: string) {
    return text.replace(
        /(-?\d+)\.(\d+)(?=\s?(?:km\/h|m\/s|°C|°|%|µS\/cm|mm|hPa|kPa|W\/m²))/g,
        '$1,$2',
    );
}

function formatResponseForBrazil(event: PrimaryAiDoneEvent, currentText: string) {
    const sourceText = currentText || event.response;
    const agentResults = event.agentResults ?? (event.agentResult ? [event.agentResult] : []);
    const withIsoDates = sourceText.replace(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})/g,
        (timestamp) => formatTimestampForBrazil(timestamp),
    );
    const withKnownUtcDisplays = replaceKnownUtcClockDisplays(withIsoDates, agentResults);

    return formatNumbersForBrazil(withKnownUtcDisplays);
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

    if (status.route === 'multi-agent') {
        return 'Plano multiagente';
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
        text: formatResponseForBrazil(event, message.text),
    };
}

export function applyStatusMetadata(
    event: PrimaryAiStatusEvent,
    message: DashboardMessage,
): DashboardMessage {
    if (message.role !== 'trace') {
        return message;
    }

    const activePhase =
        event.state === 'active'
            ? event.phase
            : message.activePhase === event.phase
              ? null
              : message.activePhase;

    return {
        ...message,
        activePhase,
        thinking:
            event.phase === 'thinking'
                ? appendUnique(message.thinking, event.message)
                : message.thinking,
        agentId: event.agentId !== undefined ? event.agentId : message.agentId,
        agentName: event.agentName !== undefined ? event.agentName : message.agentName,
        agentStatus: event.phase === 'agent-calling' ? event.message : message.agentStatus,
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

export function processAgentMessage(raw: string, handlers: PrimaryAiEventHandlers): boolean {
    let parsed: AgentMessage;
    try {
        parsed = JSON.parse(raw) as AgentMessage;
    } catch {
        return false;
    }

    switch (parsed.type) {
        case 'history':
            handlers.onHistory?.(parsed.data.messages);
            return false;
        case 'cleared':
            handlers.onCleared?.();
            return false;
        case 'start':
            handlers.onStart?.(parsed.data);
            return false;
        case 'status':
            handlers.onStatus?.(parsed.data);
            return false;
        case 'trace':
            handlers.onTrace?.(parsed.data);
            return false;
        case 'delta':
            handlers.onDelta?.(parsed.data.delta);
            return false;
        case 'done':
            handlers.onDone?.(parsed.data);
            return true;
        case 'error':
            throw new Error(parsed.data.message);
        default:
            return false;
    }
}
