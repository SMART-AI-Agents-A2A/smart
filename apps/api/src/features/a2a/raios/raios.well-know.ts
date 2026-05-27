import { cacheDefaultTtlSeconds } from '../../cache/cache.vo';
import { defaultFarmCode } from '../../influxdb';
import type { AgentCard } from '../core';

const provider = {
    organization: 'SMART',
};

export const lightningAgentCard: AgentCard = {
    name: 'SMART Agente de Raio',
    description:
        'Agente especialista em incidência de raios, descargas atmosféricas e risco elétrico da Fazenda NSAAB usando Atmos41 e tools MCP.',
    url: '/v1/a2a/agents/raio',
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
            id: 'smart.lightning.incidence',
            name: 'Incidência de raios',
            description:
                'Consulta incidência de raios da Fazenda NSAAB no sensor Atmos41 usando a tool MCP smart_lightning_incidence.',
            tags: ['raio', 'raios', 'incidencia', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Houve incidência de raios na Fazenda NSAAB?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
        {
            id: 'smart.lightning.strikes',
            name: 'Descargas atmosféricas',
            description:
                'Consulta descargas atmosféricas da Fazenda NSAAB no sensor Atmos41 usando a tool MCP smart_lightning_strikes.',
            tags: ['raio', 'descargas-atmosfericas', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Quantas descargas atmosféricas foram registradas?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
        {
            id: 'smart.lightning.risk',
            name: 'Risco elétrico',
            description:
                'Avalia risco elétrico por raios da Fazenda NSAAB no sensor Atmos41 usando a tool MCP smart_lightning_risk.',
            tags: ['raio', 'risco-eletrico', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Existe risco elétrico por raios na Fazenda NSAAB?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
    ],
    provider,
    metadata: {
        farmCode: defaultFarmCode,
        farmName: 'Fazenda NSAAB',
        scope: 'Agente A2A especialista de raios restrito à Fazenda NSAAB.',
        consideredSensors: ['Atmos41'],
        metricFilter: {
            field: 'metric',
            allowedValues: ['incidence', 'strikes', 'risk'],
            defaultValue: 'incidence',
        },
        sensorGroups: ['Raios'],
        measuredFields: ['LightningDistance', 'LightningStrikes'],
        allowedFarmCode: defaultFarmCode,
        sourceSystem: 'influxdb',
        sourceKind: 'measured',
        cache: {
            providers: ['influxdb'],
            source: 'environmental-cache',
            ttlSeconds: cacheDefaultTtlSeconds,
            staleFallback: true,
            defaultRange: {
                start: '-6h',
                every: '20m',
            },
        },
        mcp: {
            compatible: true,
            protocol: 'tools/call',
        },
        mcpTools: ['smart_lightning_incidence', 'smart_lightning_strikes', 'smart_lightning_risk'],
    },
};
