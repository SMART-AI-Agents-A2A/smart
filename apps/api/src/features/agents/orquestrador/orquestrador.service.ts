import { v4 as uuidv4 } from 'uuid';
import {
    A2AClient,
    type Message,
    type MessageSendParams,
    type MessageSendResponse,
    type Task,
} from '../a2a/core';
import { airAgentDataPartSchema } from '../a2a/ar';
import { rainAgentDataPartSchema } from '../a2a/chuva';
import { lightningAgentDataPartSchema } from '../a2a/raios';
import { radiationAgentDataPartSchema } from '../a2a/radiacao';
import { soilAgentDataPartSchema } from '../a2a/solo';
import { windAgentDataPartSchema } from '../a2a/vento';
import { defaultFarmCode } from '../tools/influxdb/influxdb.types';
import { findOrquestradorA2ACatalogEntry, selectAgentFromA2ACards } from './orquestrador.catalog';
import type {
    OrquestradorChatRequest,
    OrquestradorChatResponse,
    OrquestradorTargetAgent,
} from './orquestrador.schemas';

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

const metadataFromA2AResponse = (response: MessageSendResponse): Record<string, unknown> => {
    if ('status' in response.result) {
        return response.result.status.message?.metadata ?? {};
    }

    return response.result.metadata;
};

const withoutUndefinedValues = (input: Record<string, unknown>): Record<string, unknown> => {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
};

const createAgentDataPart = (
    request: OrquestradorChatRequest,
    targetAgent: OrquestradorTargetAgent,
): Record<string, unknown> => {
    const commonSensorData = {
        start: request.metadata.start,
        stop: request.metadata.stop,
        every: request.metadata.every,
        pointLimit: request.metadata.pointLimit,
    };

    switch (targetAgent) {
        case 'solo':
            return soilAgentDataPartSchema.parse(
                withoutUndefinedValues({
                    group: request.metadata.group,
                    ...commonSensorData,
                }),
            );
        case 'chuva':
            return rainAgentDataPartSchema.parse(
                withoutUndefinedValues({
                    action: request.metadata.action,
                    ...commonSensorData,
                    units: request.metadata.units,
                    lang: request.metadata.lang,
                    cnt: request.metadata.cnt,
                    forecastLimit: request.metadata.forecastLimit,
                }),
            );
        case 'radiacao':
            return radiationAgentDataPartSchema.parse(withoutUndefinedValues(commonSensorData));
        case 'raio':
            return lightningAgentDataPartSchema.parse(
                withoutUndefinedValues({
                    metric: request.metadata.metric,
                    ...commonSensorData,
                }),
            );
        case 'ar':
            return airAgentDataPartSchema.parse(
                withoutUndefinedValues({
                    action: request.metadata.action,
                    metric: request.metadata.metric,
                    source: request.metadata.source,
                    ...commonSensorData,
                    units: request.metadata.units,
                    lang: request.metadata.lang,
                }),
            );
        case 'vento':
            return windAgentDataPartSchema.parse(
                withoutUndefinedValues({
                    action: request.metadata.action,
                    metric: request.metadata.metric,
                    source: request.metadata.source,
                    ...commonSensorData,
                    units: request.metadata.units,
                    lang: request.metadata.lang,
                    cnt: request.metadata.cnt,
                    forecastLimit: request.metadata.forecastLimit,
                }),
            );
    }
};

const createA2AMessageSendParams = (
    request: OrquestradorChatRequest,
    targetAgent: OrquestradorTargetAgent,
    agentCardUrl: string,
): MessageSendParams => {
    const dataPart = createAgentDataPart(request, targetAgent);
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

    if (Object.keys(dataPart).length > 0) {
        parts.push({
            kind: 'data',
            data: dataPart,
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
    const agentResultMetadata = metadataFromA2AResponse(agentResponse);

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
            agentResult: agentResultMetadata,
        },
    };
};
