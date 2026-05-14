import { v4 as uuidv4 } from 'uuid';
import {
    A2AClient,
    type Message,
    type MessageSendParams,
    type MessageSendResponse,
    type Task,
} from '../a2a/core';
import { soilAgentDataPartSchema } from '../a2a/solo';
import { defaultFarmCode } from '../tools/influxdb/influxdb.types';
import { findOrquestradorA2ACatalogEntry, selectAgentFromA2ACards } from './orquestrador.catalog';
import type { OrquestradorChatRequest, OrquestradorChatResponse } from './orquestrador.schemas';

const unknownAgentAnswer = 'Nenhum agente A2A foi selecionado para delegação.';

export interface CreateOrquestradorChatResponseOptions {
    readonly origin: string;
    readonly fetcher?: typeof fetch;
}

const textFromMessage = (message: Message): string => {
    return message.parts
        .filter((part) => part.kind === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim();
};

const textFromTask = (task: Task): string => {
    if (!task.status.message) {
        return '';
    }

    return textFromMessage(task.status.message);
};

const textFromA2AResponse = (response: MessageSendResponse): string => {
    const text =
        'status' in response.result
            ? textFromTask(response.result)
            : textFromMessage(response.result);

    return text || 'O agente A2A respondeu sem conteúdo textual.';
};

const withoutUndefinedValues = (input: Record<string, unknown>): Record<string, unknown> => {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
};

const createA2AMessageSendParams = (
    request: OrquestradorChatRequest,
    targetAgent: string,
    agentCardUrl: string,
): MessageSendParams => {
    const soilDataPart =
        targetAgent === 'solo'
            ? soilAgentDataPartSchema.parse(
                  withoutUndefinedValues({
                      group: request.metadata.group,
                      start: request.metadata.start,
                      stop: request.metadata.stop,
                      every: request.metadata.every,
                  }),
              )
            : {};
    const metadata = {
        ...request.metadata,
        farmCode: defaultFarmCode,
        orchestrator: 'smart-orquestrador',
        targetAgent,
        agentCardUrl,
    };
    const parts: Message['parts'] = [
        {
            kind: 'text',
            text: request.message,
        },
    ];

    if (targetAgent === 'solo' && Object.keys(soilDataPart).length > 0) {
        parts.push({
            kind: 'data',
            data: soilDataPart,
        });
    }

    return {
        message: {
            messageId: uuidv4(),
            role: 'user',
            parts,
            metadata,
        },
        metadata,
    };
};

export const createOrquestradorChatResponse = async (
    request: OrquestradorChatRequest,
    options: CreateOrquestradorChatResponseOptions,
): Promise<OrquestradorChatResponse> => {
    const routing = selectAgentFromA2ACards(request.targetAgent);
    const entry = routing.delegation
        ? findOrquestradorA2ACatalogEntry(routing.delegation.targetAgent)
        : undefined;

    if (!routing.delegation || !entry) {
        return {
            requestId: uuidv4(),
            farmCode: defaultFarmCode,
            intent: routing.intent,
            answer: unknownAgentAnswer,
            delegation: routing.delegation,
            metadata: {
                ...request.metadata,
                receivedText: request.message,
                routingMode: 'a2a-agent-card-explicit-selection',
                delegated: false,
            },
        };
    }

    const agentBaseUrl = new URL(entry.card.url, options.origin).toString();
    const client = new A2AClient({
        baseUrl: agentBaseUrl,
        fetcher: options.fetcher,
    });
    const agentCard = await client.getAgentCard();
    const a2aParams = createA2AMessageSendParams(request, entry.targetAgent, entry.card.url);
    const agentResponse = await client.sendMessage(a2aParams);

    return {
        requestId: uuidv4(),
        farmCode: defaultFarmCode,
        intent: routing.intent,
        answer: textFromA2AResponse(agentResponse),
        delegation: routing.delegation,
        metadata: {
            ...request.metadata,
            receivedText: request.message,
            routingMode: 'a2a-agent-card-explicit-selection',
            delegated: true,
            agentCard: {
                name: agentCard.name,
                url: agentCard.url,
                version: agentCard.version,
                skills: agentCard.skills.map((skill) => skill.id),
            },
            a2aResponseId: agentResponse.id,
            a2aMessageParts: a2aParams.message.parts.map((part) => part.kind),
        },
    };
};
