import { cacheDefaultTtlSeconds } from '../../tools/cache/cache.types';
import { defaultFarmCode } from '../../tools/influxdb';
import type { AgentCard } from '../core';

const provider = {
    organization: 'SMART',
};

export const windAgentCard: AgentCard = {
    name: 'SMART Agente de Vento',
    description:
        'Agente especialista em velocidade, direção e rajadas de vento da Fazenda NSAAB usando Atmos41 e tools MCP.',
    url: '/v1/a2a/agents/vento',
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
            id: 'smart.wind.speed',
            name: 'Velocidade do vento',
            description:
                'Consulta velocidade do vento da Fazenda NSAAB no sensor Atmos41 usando a tool MCP smart_wind_speed.',
            tags: ['vento', 'velocidade-do-vento', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Qual foi a velocidade do vento medida na Fazenda NSAAB?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
        {
            id: 'smart.wind.direction',
            name: 'Direção do vento',
            description:
                'Consulta direção do vento da Fazenda NSAAB no sensor Atmos41 usando a tool MCP smart_wind_direction.',
            tags: ['vento', 'direcao-do-vento', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Qual foi a direção do vento medida pelo Atmos41?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
        {
            id: 'smart.wind.gust',
            name: 'Rajadas de vento',
            description:
                'Consulta rajadas de vento da Fazenda NSAAB no sensor Atmos41 usando a tool MCP smart_wind_gust.',
            tags: ['vento', 'rajadas-de-vento', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Houve rajadas de vento fortes na Fazenda NSAAB?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
    ],
    provider,
    metadata: {
        farmCode: defaultFarmCode,
        farmName: 'Fazenda NSAAB',
        scope: 'Agente A2A especialista de vento restrito à Fazenda NSAAB.',
        consideredSensors: ['Atmos41'],
        metricFilter: {
            field: 'metric',
            allowedValues: ['speed', 'direction', 'gust'],
            defaultValue: 'speed',
        },
        sensorGroups: ['Vento'],
        measuredFields: ['WindDirection', 'WindSpeed', 'WindGust'],
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
        mcpTools: ['smart_wind_speed', 'smart_wind_direction', 'smart_wind_gust'],
    },
};
