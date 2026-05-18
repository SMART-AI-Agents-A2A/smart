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
            'Nesta base inicial eu apenas recebo mensagens e preparo a coordenação com Solo e Chuva.',
            'MCP, InfluxDB, OpenWeather e agentes reais serão conectados depois.',
        ].join(' '),
        {
            agent: 'orchestrator',
            farmCode: defaultFarmCode,
            receivedText: prompt,
            availableAgents: ['solo', 'chuva'],
            mcpEnabled: false,
        },
    );

    return createCompletedTask(message, { agent: 'orchestrator', farmCode: defaultFarmCode }, [
        params.message,
    ]);
};
