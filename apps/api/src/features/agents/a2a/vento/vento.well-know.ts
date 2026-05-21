import { cacheDefaultTtlSeconds } from '../../tools/cache/cache.types';
import { defaultFarmCode } from '../../tools/influxdb';
import type { AgentCard } from '../core';

const provider = {
    organization: 'SMART',
};

export const windAgentCard: AgentCard = {
    name: 'SMART Agente de Vento',
    description:
        'Agente especialista em velocidade, direção e rajadas de vento da Fazenda NSAAB usando Atmos41, OpenWeather e tools MCP.',
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
        {
            id: 'smart.wind.current',
            name: 'Vento atual externo',
            description:
                'Consulta vento atual da Fazenda NSAAB usando OpenWeather pela tool MCP smart_wind_current_weather.',
            tags: ['vento', 'atual', 'openweather', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Qual o vento atual pela OpenWeather na Fazenda NSAAB?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
        {
            id: 'smart.wind.forecast',
            name: 'Previsão de vento externa',
            description:
                'Consulta previsão de vento da Fazenda NSAAB usando OpenWeather pela tool MCP smart_wind_forecast.',
            tags: ['vento', 'previsao', 'openweather', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Qual a previsão de vento para a Fazenda NSAAB?'],
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
        sourceFilter: {
            field: 'source',
            allowedValues: ['sensor', 'external'],
            defaultValue: 'sensor',
        },
        actionFilter: {
            field: 'action',
            allowedValues: ['measured', 'current', 'forecast'],
            defaultValue: 'measured',
            aliases: {
                measured: 'sensor',
                current: 'external',
                forecast: 'external',
            },
        },
        sensorGroups: ['Vento'],
        measuredFields: ['WindDirection', 'WindSpeed', 'WindGust'],
        allowedFarmCode: defaultFarmCode,
        sourceSystems: ['influxdb', 'openweather'],
        sourceKinds: ['measured', 'external'],
        cache: {
            providers: ['influxdb', 'openweather'],
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
        mcpTools: [
            'smart_wind_speed',
            'smart_wind_direction',
            'smart_wind_gust',
            'smart_wind_current_weather',
            'smart_wind_forecast',
        ],
    },
};
