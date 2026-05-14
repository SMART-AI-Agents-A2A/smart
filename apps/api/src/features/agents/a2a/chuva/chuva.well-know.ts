import { defaultFarmCode } from '../../tools/influxdb';
import type { AgentCard } from '../core';

const provider = {
    organization: 'SMART',
};

export const rainAgentCard: AgentCard = {
    name: 'SMART Agente de Chuva',
    description:
        'Agente especialista em chuva e precipitação da Fazenda NSAAB usando Atmos41, OpenWeather e tools MCP.',
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
            id: 'smart.rain.forecast',
            name: 'Previsão de chuva',
            description:
                'Consulta previsão de chuva da Fazenda NSAAB usando a tool MCP smart_rain_forecast e dados externos OpenWeather.',
            tags: ['chuva', 'previsao', 'openweather', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Qual a previsão de chuva para a Fazenda NSAAB?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
        {
            id: 'smart.rain.accumulated',
            name: 'Chuva acumulada',
            description:
                'Consulta chuva acumulada da Fazenda NSAAB no sensor Atmos41 usando a tool MCP smart_rain_accumulated.',
            tags: ['chuva', 'acumulado', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Qual a chuva acumulada nas últimas 24 horas?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
        {
            id: 'smart.rain.risk',
            name: 'Risco de chuva',
            description:
                'Avalia risco de chuva combinando previsão OpenWeather e chuva acumulada Atmos41 quando solicitado.',
            tags: ['chuva', 'risco', 'openweather', 'atmos41', 'fazenda-nsaab', 'mcp', 'smart'],
            examples: ['Existe risco de chuva na Fazenda NSAAB?'],
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
        },
    ],
    provider,
    metadata: {
        farmCode: defaultFarmCode,
        farmName: 'Fazenda NSAAB',
        scope: 'Agente A2A especialista de chuva restrito à Fazenda NSAAB.',
        consideredSensors: ['Atmos41'],
        allowedFarmCode: defaultFarmCode,
        sourceSystems: ['influxdb', 'openweather'],
        sourceKinds: ['measured', 'external'],
        mcpTools: ['smart_rain_accumulated', 'smart_rain_forecast'],
    },
};
