import { defaultFarmCode } from '../../tools/influxdb';
import type { AgentCard } from '../core';

const provider = {
    organization: 'SMART',
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
        farmCode: defaultFarmCode,
        farmName: 'Fazenda NSAAB',
        scope: 'Agente A2A especialista de solo restrito à Fazenda NSAAB.',
        consideredSensors: ['Teros12'],
        allowedFarmCode: defaultFarmCode,
        sourceSystem: 'influxdb',
        sourceKind: 'measured',
        mcpTools: ['smart_soil_data'],
    },
};
