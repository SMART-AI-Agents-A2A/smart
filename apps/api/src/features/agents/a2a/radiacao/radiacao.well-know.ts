import { defaultFarmCode } from '../../tools/influxdb';
import type { AgentCard } from '../core';

const provider = {
    organization: 'SMART',
};

export const radiationAgentCard: AgentCard = {
    name: 'SMART Agente de Radiação',
    description:
        'Agente especialista em radiação solar medida da Fazenda NSAAB usando Atmos41 e tools MCP.',
    url: '/v1/a2a/agents/radiacao',
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
            id: 'smart.radiation.solar',
            name: 'Radiação solar',
            description:
                'Consulta radiação solar medida da Fazenda NSAAB no sensor Atmos41 usando a tool MCP smart_radiation_solar.',
            tags: ['radiacao', 'radiacao-solar', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Qual foi a radiação solar medida na Fazenda NSAAB?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
    ],
    provider,
    metadata: {
        farmCode: defaultFarmCode,
        farmName: 'Fazenda NSAAB',
        scope: 'Agente A2A especialista de radiação restrito à Fazenda NSAAB.',
        consideredSensors: ['Atmos41'],
        allowedFarmCode: defaultFarmCode,
        sourceSystem: 'influxdb',
        sourceKind: 'measured',
        mcpTools: ['smart_radiation_solar'],
        unsupportedMetrics: ['uv_index', 'insolation'],
        unsupportedReason:
            'OpenWeather 2.5 usado no projeto não retorna UV ou insolação; este agente usa apenas radiação solar medida pelo Atmos41.',
    },
};
