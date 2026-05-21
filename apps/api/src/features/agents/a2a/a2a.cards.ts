import { defaultFarmCode } from '../tools/influxdb';
import { airAgentCard } from './ar';
import { rainAgentCard } from './chuva';
import type { AgentCard } from './core';
import { lightningAgentCard } from './raios';
import { radiationAgentCard } from './radiacao';
import { windAgentCard } from './vento';

export { airAgentCard } from './ar';
export { rainAgentCard } from './chuva';
export { lightningAgentCard } from './raios';
export { radiationAgentCard } from './radiacao';
export { windAgentCard } from './vento';

const provider = {
    organization: 'SMART',
};

const farmMetadata = {
    farmCode: defaultFarmCode,
    farmName: 'Fazenda NSAAB',
    scope: 'Comunicação A2A entre agentes SMART restrita à Fazenda NSAAB.',
};

const orchestratorAvailableAgents = [
    {
        id: 'solo',
        name: 'SMART Agente de Solo',
        agentCardUrl: '/v1/a2a/agents/solo/.well-known/agent-card.json',
        endpointUrl: '/v1/a2a/agents/solo',
    },
    {
        id: 'chuva',
        name: 'SMART Agente de Chuva',
        agentCardUrl: '/v1/a2a/agents/chuva/.well-known/agent-card.json',
        endpointUrl: '/v1/a2a/agents/chuva',
    },
    {
        id: 'radiacao',
        name: 'SMART Agente de Radiação',
        agentCardUrl: '/v1/a2a/agents/radiacao/.well-known/agent-card.json',
        endpointUrl: '/v1/a2a/agents/radiacao',
    },
    {
        id: 'raio',
        name: 'SMART Agente de Raio',
        agentCardUrl: '/v1/a2a/agents/raio/.well-known/agent-card.json',
        endpointUrl: '/v1/a2a/agents/raio',
    },
    {
        id: 'ar',
        name: 'SMART Agente de Ar',
        agentCardUrl: '/v1/a2a/agents/ar/.well-known/agent-card.json',
        endpointUrl: '/v1/a2a/agents/ar',
    },
    {
        id: 'vento',
        name: 'SMART Agente de Vento',
        agentCardUrl: '/v1/a2a/agents/vento/.well-known/agent-card.json',
        endpointUrl: '/v1/a2a/agents/vento',
    },
] as const;

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
                'Recebe uma mensagem e coordena delegação A2A explícita entre agentes especialistas da Fazenda NSAAB.',
            tags: ['orquestracao', 'fazenda-nsaab', 'smart'],
            examples: [
                'Analise solo e chuva para a Fazenda NSAAB.',
                'Delegue a análise de vento para o agente especializado.',
                'Verifique radiação, raios e condições do ar com os agentes ambientais.',
            ],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
    ],
    provider,
    metadata: {
        ...farmMetadata,
        consideredSensors: ['Atmos41', 'Teros12'],
        availableAgents: orchestratorAvailableAgents,
        targetAgents: orchestratorAvailableAgents.map((agent) => agent.id),
        discovery: {
            type: 'a2a-agent-card',
            wellKnownPath: '/.well-known/agent-card.json',
            catalogSource: 'orquestrador-a2a-catalog',
        },
    },
};

export const soilAgentCard: AgentCard = {
    name: 'SMART Agente de Solo',
    description:
        'Agente especialista em dados edáficos da Fazenda NSAAB usando sensores Teros12 e tools MCP.',
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
            id: 'smart.soil.moisture',
            name: 'Umidade do solo',
            description:
                'Consulta umidade do solo da Fazenda NSAAB no sensor Teros12 usando a tool MCP smart_soil_data.',
            tags: ['solo', 'umidade-do-solo', 'teros12', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Como está a umidade do solo na Fazenda NSAAB?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
        {
            id: 'smart.soil.temperature',
            name: 'Temperatura do solo',
            description:
                'Consulta temperatura do solo da Fazenda NSAAB no sensor Teros12 usando a tool MCP smart_soil_data.',
            tags: ['solo', 'temperatura-do-solo', 'teros12', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Qual foi a temperatura do solo medida pelo Teros12?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
        {
            id: 'smart.soil.electrical-conductivity',
            name: 'Condutividade elétrica do solo',
            description:
                'Consulta condutividade elétrica do solo da Fazenda NSAAB no sensor Teros12 usando a tool MCP smart_soil_data.',
            tags: ['solo', 'condutividade-eletrica', 'teros12', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Como está a condutividade elétrica do solo?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
    ],
    provider,
    metadata: {
        ...farmMetadata,
        consideredSensors: ['Teros12'],
        allowedFarmCode: defaultFarmCode,
        sourceSystem: 'influxdb',
        sourceKind: 'measured',
        mcpTools: ['smart_soil_data'],
    },
};

export const a2aAgentCards = {
    orchestrator: orchestratorAgentCard,
    solo: soilAgentCard,
    chuva: rainAgentCard,
    radiacao: radiationAgentCard,
    raio: lightningAgentCard,
    ar: airAgentCard,
    vento: windAgentCard,
} as const;
