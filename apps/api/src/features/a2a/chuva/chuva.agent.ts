import { z } from 'zod';
import { createEnvironmentalMcpRegistry } from '../../mcp';
import { defaultFarmCode } from '../../influxdb';
import {
    createAgentMessage,
    createCompletedTask,
    createInputRequiredTask,
    type A2AMessageSendContext,
    type A2AMessageSendHandler,
    type MessageSendParams,
} from '../core';
import {
    createRainAccumulatedMcpArguments,
    createRainForecastMcpArguments,
    extractRainAgentRequestData,
    getRainAgentAction,
    getRainForecastLimit,
    getRainPointLimit,
    type RainAgentAction,
    type RainAgentLimit,
} from './chuva.tools';

const environmentalMcpRegistry = createEnvironmentalMcpRegistry();

const rainAccumulatedStructuredContentSchema = z.object({
    sourceKind: z.literal('measured'),
    sourceSystem: z.literal('influxdb'),
    farmCode: z.literal(defaultFarmCode),
    sensor: z.literal('Atmos41'),
    external: z.literal(false),
    hasData: z.boolean(),
    emptyReason: z.string().nullable(),
    payload: z.object({
        key: z.string().min(1),
        provider: z.literal('influxdb'),
        data: z.object({
            sensor: z.literal('Atmos41'),
            range: z.object({
                farmCode: z.literal(defaultFarmCode),
                start: z.string().min(1),
                stop: z.string().min(1),
                every: z.string().min(1),
            }),
            groups: z.array(
                z.object({
                    name: z.string().min(1),
                    fields: z.array(
                        z.object({
                            field: z.string().min(1),
                            unit: z.string(),
                            sources: z.array(
                                z.object({
                                    groupByValue: z.string().min(1),
                                    points: z.array(
                                        z.object({
                                            time: z.string().min(1),
                                            value: z.number(),
                                            unit: z.string(),
                                        }),
                                    ),
                                }),
                            ),
                        }),
                    ),
                }),
            ),
        }),
        cache: z.object({
            updatedAt: z.string().min(1),
            expiresAt: z.string().min(1),
            ttlSeconds: z.number().int().positive(),
            stale: z.boolean(),
            source: z.enum(['cache', 'origin', 'stale']),
        }),
    }),
});
type RainAccumulatedStructuredContent = z.infer<typeof rainAccumulatedStructuredContentSchema>;

const rainForecastStructuredContentSchema = z.object({
    sourceKind: z.literal('external'),
    sourceSystem: z.literal('openweather'),
    farmCode: z.literal(defaultFarmCode),
    external: z.literal(true),
    payload: z.object({
        farm: z.object({
            name: z.string().min(1),
            latitude: z.number(),
            longitude: z.number(),
        }),
        query: z.object({
            units: z.string().min(1),
            lang: z.string().min(1),
            cnt: z.number().optional(),
        }),
        key: z.string().min(1),
        provider: z.literal('openweather'),
        data: z.object({
            list: z.array(
                z.object({
                    dt: z.number(),
                    dt_txt: z.string().optional(),
                    pop: z.number().optional(),
                    rain: z.record(z.string(), z.number()).optional(),
                    weather: z.array(
                        z.object({
                            description: z.string(),
                            main: z.string(),
                        }),
                    ),
                }),
            ),
        }),
        cache: z.object({
            updatedAt: z.string().min(1),
            expiresAt: z.string().min(1),
            ttlSeconds: z.number().int().positive(),
            stale: z.boolean(),
            source: z.enum(['cache', 'origin', 'stale']),
        }),
    }),
});
type RainForecastStructuredContent = z.infer<typeof rainForecastStructuredContentSchema>;

interface RainPointSummary {
    readonly field: string;
    readonly unit: string;
    readonly source: string;
    readonly time: string;
    readonly value: number;
}

interface RainForecastSummary {
    readonly time: string;
    readonly probabilityOfPrecipitation: number | null;
    readonly rainAmount: number | null;
    readonly description: string | null;
}

const textFromMessage = (params: MessageSendParams): string => {
    return params.message.parts
        .filter((part) => part.kind === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim();
};

const selectItems = <TItem>(
    items: readonly TItem[],
    limit: RainAgentLimit | undefined,
): readonly TItem[] => {
    if (!limit) {
        return [];
    }

    if (limit === 'all') {
        return items;
    }

    return items.slice(0, limit);
};

const rainPointsFromStructuredContent = (
    structuredContent: RainAccumulatedStructuredContent,
): readonly RainPointSummary[] => {
    return structuredContent.payload.data.groups
        .flatMap((group) =>
            group.fields.flatMap((field) =>
                field.sources.flatMap((source) =>
                    source.points.map(
                        (point): RainPointSummary => ({
                            field: field.field,
                            unit: point.unit || field.unit,
                            source: source.groupByValue,
                            time: point.time,
                            value: point.value,
                        }),
                    ),
                ),
            ),
        )
        .sort((left, right) => left.time.localeCompare(right.time));
};

const forecastsFromStructuredContent = (
    structuredContent: RainForecastStructuredContent,
): readonly RainForecastSummary[] => {
    return structuredContent.payload.data.list.map((item) => {
        const rainAmount = item.rain
            ? Object.values(item.rain).reduce((sum, value) => sum + value, 0)
            : null;

        return {
            time: item.dt_txt ?? new Date(item.dt * 1000).toISOString(),
            probabilityOfPrecipitation: item.pop ?? null,
            rainAmount,
            description: item.weather[0]?.description ?? null,
        };
    });
};

const createAccumulatedAnswer = (
    structuredContent: RainAccumulatedStructuredContent,
    selectedPoints: readonly RainPointSummary[],
    pointLimit: RainAgentLimit | undefined,
): string => {
    const range = structuredContent.payload.data.range;

    if (!structuredContent.hasData) {
        return [
            `Consultei chuva acumulada da ${defaultFarmCode} via MCP smart_rain_accumulated/Atmos41.`,
            `Não encontrei séries para a janela ${range.start} até ${range.stop}.`,
            structuredContent.emptyReason ??
                'Nenhum dado medido foi retornado pelo cache ambiental.',
        ].join(' ');
    }

    const points = rainPointsFromStructuredContent(structuredContent);
    const total = points.reduce((sum, point) => sum + point.value, 0);
    const firstPoint = points[0];
    const latestPoint = points.at(-1);

    return [
        `Consultei chuva acumulada da ${defaultFarmCode} via MCP smart_rain_accumulated/Atmos41.`,
        `Janela consultada: ${range.start} até ${range.stop}, agregado a cada ${range.every}.`,
        `Encontrei ${points.length} ponto(s) consolidado(s), totalizando ${total} mm.`,
        `Cache ambiental: ${structuredContent.payload.cache.source}, TTL ${structuredContent.payload.cache.ttlSeconds}s, stale=${structuredContent.payload.cache.stale}.`,
        pointLimit
            ? `Retornando ${selectedPoints.length} ponto(s) selecionado(s) em metadata.agentResult.selectedPoints.`
            : 'Informe pointLimit para receber pontos em metadata.agentResult.selectedPoints.',
        firstPoint
            ? `Primeira leitura: ${firstPoint.value} ${firstPoint.unit} em ${firstPoint.time}.`
            : '',
        latestPoint
            ? `Última leitura: ${latestPoint.value} ${latestPoint.unit} em ${latestPoint.time}.`
            : '',
    ]
        .filter(Boolean)
        .join(' ');
};

const createForecastAnswer = (
    structuredContent: RainForecastStructuredContent,
    selectedForecasts: readonly RainForecastSummary[],
    forecastLimit: RainAgentLimit | undefined,
): string => {
    const forecasts = forecastsFromStructuredContent(structuredContent);
    const maxPop = forecasts.reduce(
        (max, forecast) => Math.max(max, forecast.probabilityOfPrecipitation ?? 0),
        0,
    );
    const totalRain = forecasts.reduce((sum, forecast) => sum + (forecast.rainAmount ?? 0), 0);

    return [
        `Consultei previsão de chuva da ${defaultFarmCode} via MCP smart_rain_forecast/OpenWeather.`,
        `Encontrei ${forecasts.length} previsão(ões).`,
        `Maior probabilidade de precipitação: ${Math.round(maxPop * 100)}%.`,
        `Chuva prevista somada nos itens retornados: ${totalRain} mm.`,
        `Cache ambiental: ${structuredContent.payload.cache.source}, TTL ${structuredContent.payload.cache.ttlSeconds}s, stale=${structuredContent.payload.cache.stale}.`,
        forecastLimit
            ? `Retornando ${selectedForecasts.length} previsão(ões) selecionada(s) em metadata.agentResult.selectedForecasts.`
            : 'Informe forecastLimit para receber previsões em metadata.agentResult.selectedForecasts.',
    ].join(' ');
};

const createRiskAnswer = (
    forecast: RainForecastStructuredContent,
    accumulated: RainAccumulatedStructuredContent,
): string => {
    const forecasts = forecastsFromStructuredContent(forecast);
    const maxPop = forecasts.reduce(
        (max, item) => Math.max(max, item.probabilityOfPrecipitation ?? 0),
        0,
    );
    const forecastRain = forecasts.reduce((sum, item) => sum + (item.rainAmount ?? 0), 0);
    const measuredRain = rainPointsFromStructuredContent(accumulated).reduce(
        (sum, point) => sum + point.value,
        0,
    );
    const riskLevel =
        maxPop >= 0.7 || forecastRain >= 10 ? 'alto' : maxPop >= 0.4 ? 'moderado' : 'baixo';

    return [
        `Avaliei risco de chuva da ${defaultFarmCode} combinando OpenWeather e Atmos41 via MCP.`,
        `Risco estimado: ${riskLevel}.`,
        `Maior probabilidade prevista: ${Math.round(maxPop * 100)}%.`,
        `Chuva prevista somada: ${forecastRain} mm.`,
        `Chuva medida acumulada na janela consultada: ${measuredRain} mm.`,
        `Cache previsão: ${forecast.payload.cache.source}, TTL ${forecast.payload.cache.ttlSeconds}s, stale=${forecast.payload.cache.stale}.`,
        `Cache medido: ${accumulated.payload.cache.source}, TTL ${accumulated.payload.cache.ttlSeconds}s, stale=${accumulated.payload.cache.stale}.`,
    ].join(' ');
};

const createMissingActionTask = (params: MessageSendParams, prompt: string) => {
    const message = createAgentMessage(
        [
            'Para consultar chuva via A2A, informe action em metadata.action ou em uma data part.',
            'Ações aceitas: forecast, accumulated, risk.',
        ].join(' '),
        {
            agent: 'chuva',
            farmCode: defaultFarmCode,
            receivedText: prompt,
            protocol: 'a2a',
            requiredInput: {
                field: 'action',
                allowedValues: ['forecast', 'accumulated', 'risk'],
            },
        },
    );

    return createInputRequiredTask(
        message,
        {
            agent: 'chuva',
            farmCode: defaultFarmCode,
            protocol: 'a2a',
            requiredInput: 'action',
        },
        [params.message],
    );
};

export const rainMessageSendHandler: A2AMessageSendHandler = async (
    params,
    context: A2AMessageSendContext,
) => {
    const prompt = textFromMessage(params);
    const requestData = extractRainAgentRequestData(params);
    const action = getRainAgentAction(requestData);

    if (!action) {
        return createMissingActionTask(params, prompt);
    }

    if (action === 'forecast') {
        const forecastArguments = createRainForecastMcpArguments(requestData);
        const mcpResult = await environmentalMcpRegistry.callTool(
            'smart_rain_forecast',
            forecastArguments,
            { env: context.env },
        );
        const structuredContent = rainForecastStructuredContentSchema.parse(
            mcpResult.structuredContent,
        );
        const forecasts = forecastsFromStructuredContent(structuredContent);
        const forecastLimit = getRainForecastLimit(requestData);
        const selectedForecasts = selectItems(forecasts, forecastLimit);
        const message = createAgentMessage(
            createForecastAnswer(structuredContent, selectedForecasts, forecastLimit),
            {
                agent: 'chuva',
                farmCode: defaultFarmCode,
                receivedText: prompt,
                dataSourcesEnabled: true,
                protocol: 'a2a',
                action,
                mcpTool: 'smart_rain_forecast',
                mcpArguments: forecastArguments,
                sourceKind: structuredContent.sourceKind,
                sourceSystem: structuredContent.sourceSystem,
                external: structuredContent.external,
                cacheKey: structuredContent.payload.key,
                cacheProvider: structuredContent.payload.provider,
                cache: structuredContent.payload.cache,
                farm: structuredContent.payload.farm,
                query: structuredContent.payload.query,
                forecastCount: forecasts.length,
                forecastLimit: forecastLimit ?? null,
                selectedForecastCount: selectedForecasts.length,
                selectedForecasts,
            },
        );

        return createCompletedTask(
            message,
            {
                agent: 'chuva',
                farmCode: defaultFarmCode,
                protocol: 'a2a',
                action,
                mcpTool: 'smart_rain_forecast',
                cacheSource: structuredContent.payload.cache.source,
                cacheStale: structuredContent.payload.cache.stale,
                cacheTtlSeconds: structuredContent.payload.cache.ttlSeconds,
                forecastCount: forecasts.length,
                selectedForecastCount: selectedForecasts.length,
            },
            [params.message],
        );
    }

    if (action === 'accumulated') {
        const accumulatedArguments = createRainAccumulatedMcpArguments(requestData);
        const mcpResult = await environmentalMcpRegistry.callTool(
            'smart_rain_accumulated',
            accumulatedArguments,
            { env: context.env },
        );
        const structuredContent = rainAccumulatedStructuredContentSchema.parse(
            mcpResult.structuredContent,
        );
        const points = rainPointsFromStructuredContent(structuredContent);
        const pointLimit = getRainPointLimit(requestData);
        const selectedPoints = selectItems(points, pointLimit);
        const message = createAgentMessage(
            createAccumulatedAnswer(structuredContent, selectedPoints, pointLimit),
            {
                agent: 'chuva',
                farmCode: defaultFarmCode,
                receivedText: prompt,
                dataSourcesEnabled: true,
                protocol: 'a2a',
                action,
                mcpTool: 'smart_rain_accumulated',
                mcpArguments: accumulatedArguments,
                sourceKind: structuredContent.sourceKind,
                sourceSystem: structuredContent.sourceSystem,
                sensor: structuredContent.sensor,
                cacheKey: structuredContent.payload.key,
                cacheProvider: structuredContent.payload.provider,
                cache: structuredContent.payload.cache,
                hasData: structuredContent.hasData,
                emptyReason: structuredContent.emptyReason,
                range: structuredContent.payload.data.range,
                pointCount: points.length,
                pointLimit: pointLimit ?? null,
                selectedPointCount: selectedPoints.length,
                selectedPoints,
            },
        );

        return createCompletedTask(
            message,
            {
                agent: 'chuva',
                farmCode: defaultFarmCode,
                protocol: 'a2a',
                action,
                mcpTool: 'smart_rain_accumulated',
                cacheSource: structuredContent.payload.cache.source,
                cacheStale: structuredContent.payload.cache.stale,
                cacheTtlSeconds: structuredContent.payload.cache.ttlSeconds,
                hasData: structuredContent.hasData,
                pointCount: points.length,
                selectedPointCount: selectedPoints.length,
            },
            [params.message],
        );
    }

    const forecastArguments = createRainForecastMcpArguments(requestData);
    const accumulatedArguments = createRainAccumulatedMcpArguments(requestData);
    const [forecastResult, accumulatedResult] = await Promise.all([
        environmentalMcpRegistry.callTool('smart_rain_forecast', forecastArguments, {
            env: context.env,
        }),
        environmentalMcpRegistry.callTool('smart_rain_accumulated', accumulatedArguments, {
            env: context.env,
        }),
    ]);
    const forecast = rainForecastStructuredContentSchema.parse(forecastResult.structuredContent);
    const accumulated = rainAccumulatedStructuredContentSchema.parse(
        accumulatedResult.structuredContent,
    );
    const forecasts = forecastsFromStructuredContent(forecast);
    const measuredPoints = rainPointsFromStructuredContent(accumulated);
    const message = createAgentMessage(createRiskAnswer(forecast, accumulated), {
        agent: 'chuva',
        farmCode: defaultFarmCode,
        receivedText: prompt,
        dataSourcesEnabled: true,
        protocol: 'a2a',
        action: action satisfies RainAgentAction,
        mcpTools: ['smart_rain_forecast', 'smart_rain_accumulated'],
        forecast: {
            sourceKind: forecast.sourceKind,
            sourceSystem: forecast.sourceSystem,
            external: forecast.external,
            mcpArguments: forecastArguments,
            cacheKey: forecast.payload.key,
            cacheProvider: forecast.payload.provider,
            cache: forecast.payload.cache,
            farm: forecast.payload.farm,
            query: forecast.payload.query,
            forecastCount: forecasts.length,
        },
        accumulated: {
            sourceKind: accumulated.sourceKind,
            sourceSystem: accumulated.sourceSystem,
            sensor: accumulated.sensor,
            hasData: accumulated.hasData,
            emptyReason: accumulated.emptyReason,
            mcpArguments: accumulatedArguments,
            cacheKey: accumulated.payload.key,
            cacheProvider: accumulated.payload.provider,
            cache: accumulated.payload.cache,
            range: accumulated.payload.data.range,
            pointCount: measuredPoints.length,
        },
    });

    return createCompletedTask(
        message,
        {
            agent: 'chuva',
            farmCode: defaultFarmCode,
            protocol: 'a2a',
            action,
            mcpTools: ['smart_rain_forecast', 'smart_rain_accumulated'],
            cache: {
                forecast: {
                    source: forecast.payload.cache.source,
                    stale: forecast.payload.cache.stale,
                    ttlSeconds: forecast.payload.cache.ttlSeconds,
                },
                accumulated: {
                    source: accumulated.payload.cache.source,
                    stale: accumulated.payload.cache.stale,
                    ttlSeconds: accumulated.payload.cache.ttlSeconds,
                },
            },
        },
        [params.message],
    );
};
