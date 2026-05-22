import { cacheDefaultTtlSeconds } from '../../tools/cache/cache.vo';
import { defaultFarmCode } from '../../tools/influxdb/influxdb.vo';
import type { AgentCard } from '../core';

const provider = {
    organization: 'SMART',
};

export const airAgentCard: AgentCard = {
    name: 'SMART Agente de Ar',
    description:
        'Agente especialista em temperatura, umidade, pressão e condições gerais do ar da Fazenda NSAAB usando Atmos41, OpenWeather e tools MCP.',
    url: '/v1/a2a/agents/ar',
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
            id: 'smart.air.temperature',
            name: 'Temperatura do ar',
            description:
                'Consulta temperatura do ar da Fazenda NSAAB no sensor Atmos41 usando a tool MCP smart_air_temperature.',
            tags: ['ar', 'temperatura-do-ar', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Qual foi a temperatura do ar medida na Fazenda NSAAB?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
        {
            id: 'smart.air.humidity',
            name: 'Umidade do ar',
            description:
                'Consulta umidade do ar da Fazenda NSAAB no sensor Atmos41 usando a tool MCP smart_air_humidity.',
            tags: ['ar', 'umidade-do-ar', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Como está a umidade do ar na Fazenda NSAAB?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
        {
            id: 'smart.air.pressure',
            name: 'Pressão atmosférica',
            description:
                'Consulta pressão atmosférica da Fazenda NSAAB no sensor Atmos41 usando a tool MCP smart_air_pressure.',
            tags: ['ar', 'pressao-atmosferica', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Qual foi a pressão atmosférica medida pelo Atmos41?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
        {
            id: 'smart.air.conditions',
            name: 'Condições gerais do ar',
            description:
                'Consulta condições gerais do ar da Fazenda NSAAB no sensor Atmos41 usando a tool MCP smart_air_conditions.',
            tags: ['ar', 'condicoes-do-ar', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Resumo das condições gerais do ar na Fazenda NSAAB.'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
    ],
    provider,
    metadata: {
        farmCode: defaultFarmCode,
        farmName: 'Fazenda NSAAB',
        scope: 'Agente A2A especialista de ar restrito à Fazenda NSAAB.',
        consideredSensors: ['Atmos41'],
        sourceFilter: {
            field: 'source',
            allowedValues: ['sensor', 'external'],
            defaultValue: 'sensor',
        },
        actionFilter: {
            field: 'action',
            allowedValues: ['measured', 'current'],
            defaultValue: 'measured',
            aliases: {
                measured: 'sensor',
                current: 'external',
            },
        },
        sensorGroups: ['Ar'],
        measuredFields: ['AirTemperature', 'AirHumidity', 'AtmPressure', 'VaporPressure'],
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
            'smart_air_temperature',
            'smart_air_humidity',
            'smart_air_pressure',
            'smart_air_conditions',
            'smart_air_current_weather',
        ],
    },
};
