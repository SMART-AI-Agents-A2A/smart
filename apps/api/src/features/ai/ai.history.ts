import type { StoredAssistantTrace, StoredChatMessage } from './ai.type';

/**
 * The frontend resends the full conversation each turn carrying only
 * `{ role, content }`, so prior assistant messages arrive without their trace.
 * Re-attach the traces persisted in agent state (matched by content) so every
 * assistant turn keeps its thinking, not just the latest one.
 */
export function mergeStoredAssistantTraces(
    previous: Array<StoredChatMessage>,
    next: Array<StoredChatMessage>,
): Array<StoredChatMessage> {
    const previousTraces = new Map<string, StoredAssistantTrace>();
    for (const message of previous) {
        if (message.role === 'assistant' && message.trace) {
            previousTraces.set(message.content, message.trace);
        }
    }

    return next.map((message) => {
        if (message.role === 'assistant' && !message.trace) {
            const trace = previousTraces.get(message.content);
            if (trace) {
                return { ...message, trace };
            }
        }

        return message;
    });
}
