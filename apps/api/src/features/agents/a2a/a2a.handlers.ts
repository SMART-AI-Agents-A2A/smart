import { defaultFarmCode } from '../tools/influxdb/influxdb.types';
import { createAgentMessage, createCompletedTask, type A2AMessageSendHandler } from './core';

const textFromMessage = (params: Parameters<A2AMessageSendHandler>[0]): string => {
    return params.message.parts
        .filter((part) => part.kind === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim();
};

export const orchestratorMessageSendHandler: A2AMessageSendHandler = (params) => {
    const prompt = textFromMessage(params);
    const message = createAgentMessage(
        [
            'Orquestrador SMART ativo para A2A.',
            `Escopo atual: ${defaultFarmCode} (Fazenda NSAAB).`,
            'Agentes disponíveis: Solo, Chuva, Radiação, Raio, Ar e Vento.',
            'Use o endpoint /v1/orquestrador/chat para delegação A2A explícita via Agent Cards.',
        ].join(' '),
        {
            agent: 'orchestrator',
            farmCode: defaultFarmCode,
            receivedText: prompt,
            availableAgents: ['solo', 'chuva', 'radiacao', 'raio', 'ar', 'vento'],
            mcpEnabled: true,
        },
    );

    return createCompletedTask(message, { agent: 'orchestrator', farmCode: defaultFarmCode }, [
        params.message,
    ]);
};
