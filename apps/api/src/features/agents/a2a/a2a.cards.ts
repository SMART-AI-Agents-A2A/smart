import { defaultFarmCode } from '../tools/influxdb/influxdb.types';
import type { AgentCard } from './core';

const provider = {
    organization: 'SMART',
};

const farmMetadata = {
    farmCode: defaultFarmCode,
    farmName: 'Fazenda NSAAB',
    scope: 'Comunicação A2A entre agentes SMART. MCP e tools reais serão acoplados em etapa posterior.',
};

export const orchestratorAgentCard: AgentCard = {
    name: 'SMART Orquestrador',
    description:
        'Agente orquestrador para coordenar agentes especialistas no escopo da Fazenda NSAAB.',
    url: '/v1/a2a/orchestrator',
    version: '0.1.0',
    protocolVersion: '0.2.0',
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain', 'application/json'],
    capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
    },
    skills: [
        {
            id: 'smart.orchestrator.route',
            name: 'Roteamento de agentes SMART',
            description:
                'Recebe uma mensagem e prepara a coordenação entre agentes especialistas da Fazenda NSAAB.',
            tags: ['orquestracao', 'fazenda-nsaab', 'smart'],
            examples: ['Analise solo e chuva para a Fazenda NSAAB.'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
    ],
    provider,
    metadata: farmMetadata,
};

export const soilAgentCard: AgentCard = {
    name: 'SMART Agente de Solo',
    description: 'Agente especialista em leituras e contexto de solo da Fazenda NSAAB.',
    url: '/v1/a2a/agents/solo',
    version: '0.1.0',
    protocolVersion: '0.2.0',
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain', 'application/json'],
    capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
    },
    skills: [
        {
            id: 'smart.soil.summary',
            name: 'Resumo temporário de solo',
            description:
                'Responde sobre o escopo de solo sem consultar InfluxDB ou MCP nesta base inicial.',
            tags: ['solo', 'teros12', 'fazenda-nsaab', 'smart'],
            examples: ['Como está a umidade do solo?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
    ],
    provider,
    metadata: farmMetadata,
};

export const rainAgentCard: AgentCard = {
    name: 'SMART Agente de Chuva',
    description: 'Agente especialista em chuva e precipitação da Fazenda NSAAB.',
    url: '/v1/a2a/agents/chuva',
    version: '0.1.0',
    protocolVersion: '0.2.0',
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain', 'application/json'],
    capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
    },
    skills: [
        {
            id: 'smart.rain.summary',
            name: 'Resumo temporário de chuva',
            description:
                'Responde sobre o escopo de chuva sem consultar OpenWeather, InfluxDB ou MCP nesta base inicial.',
            tags: ['chuva', 'precipitacao', 'fazenda-nsaab', 'smart'],
            examples: ['Há indicativo de chuva para a Fazenda NSAAB?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
    ],
    provider,
    metadata: farmMetadata,
};

export const a2aAgentCards = {
    orchestrator: orchestratorAgentCard,
    soil: soilAgentCard,
    rain: rainAgentCard,
} as const;
