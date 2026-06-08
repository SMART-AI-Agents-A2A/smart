import { z } from 'zod';
import { createEnvironmentalMcpRegistry } from '../../mcp';
import { defaultFarmCode } from '../../influxdb';
import {
    createAgentMessage,
    createCompletedTask,
    type A2AMessageSendContext,
    type A2AMessageSendHandler,
    type MessageSendParams,
} from '../core';
import {
    createWindExternalMcpArguments,
    createWindMcpArguments,
    extractWindAgentRequestData,
    getWindAgentAction,
    getWindAgentMetric,
    getWindAgentSource,
    getWindForecastLimit,
    getWindPointLimit,
    mcpToolByExternalWindAction,
    mcpToolByWindMetric,
    windMetricLabel,
    type WindAgentAction,
    type WindAgentMetric,
    type WindAgentPointLimit,
    type WindAgentSource,
} from './vento.tools';

const environmentalMcpRegistry = createEnvironmentalMcpRegistry();

const windMcpStructuredContentSchema = z.object({
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
type WindMcpStructuredContent = z.infer<typeof windMcpStructuredContentSchema>;

const windCurrentStructuredContentSchema = z.object({
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
        }),
        key: z.string().min(1),
        provider: z.literal('openweather'),
        data: z.object({
            wind: z
                .object({
                    speed: z.number().optional(),
                    deg: z.number().optional(),
                    gust: z.number().optional(),
                })
                .optional(),
            dt: z.number(),
            name: z.string().optional(),
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
type WindCurrentStructuredContent = z.infer<typeof windCurrentStructuredContentSchema>;

const windForecastStructuredContentSchema = z.object({
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
                    wind: z
                        .object({
                            speed: z.number().optional(),
                            deg: z.number().optional(),
                            gust: z.number().optional(),
                        })
                        .optional(),
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
type WindForecastStructuredContent = z.infer<typeof windForecastStructuredContentSchema>;

interface WindPointSummary {
    readonly field: string;
    readonly unit: string;
    readonly source: string;
    readonly time: string;
    readonly value: number;
}

interface WindForecastSummary {
    readonly time: string;
    readonly speed: number | null;
    readonly direction: number | null;
    readonly gust: number | null;
}

const textFromMessage = (params: MessageSendParams): string => {
    return params.message.parts
        .filter((part) => part.kind === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim();
};

const windPointsFromStructuredContent = (
    structuredContent: WindMcpStructuredContent,
): readonly WindPointSummary[] => {
    return structuredContent.payload.data.groups
        .flatMap((group) =>
            group.fields.flatMap((field) =>
                field.sources.flatMap((source) =>
                    source.points.map(
                        (point): WindPointSummary => ({
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

const selectPoints = (
    points: readonly WindPointSummary[],
    pointLimit: WindAgentPointLimit | undefined,
): readonly WindPointSummary[] => {
    if (!pointLimit) {
        return [];
    }

    if (pointLimit === 'all') {
        return points;
    }

    return points.slice(-pointLimit);
};

const valueForExternalMetric = (
    metric: WindAgentMetric,
    wind: { speed?: number; deg?: number; gust?: number } | undefined,
): number | null => {
    if (metric === 'speed') return wind?.speed ?? null;
    if (metric === 'direction') return wind?.deg ?? null;

    return wind?.gust ?? null;
};

const unitForExternalMetric = (metric: WindAgentMetric, units: string): string => {
    if (metric === 'direction') return '°';
    if (units === 'imperial') return 'mph';

    return 'm/s';
};

const forecastsFromStructuredContent = (
    structuredContent: WindForecastStructuredContent,
): readonly WindForecastSummary[] => {
    return structuredContent.payload.data.list.map((item) => ({
        time: item.dt_txt ?? new Date(item.dt * 1000).toISOString(),
        speed: item.wind?.speed ?? null,
        direction: item.wind?.deg ?? null,
        gust: item.wind?.gust ?? null,
    }));
};

const createAnswerText = (
    metric: WindAgentMetric,
    structuredContent: WindMcpStructuredContent,
    selectedPoints: readonly WindPointSummary[],
    pointLimit: WindAgentPointLimit | undefined,
): string => {
    const range = structuredContent.payload.data.range;
    const metricLabel = windMetricLabel[metric];
    const mcpTool = mcpToolByWindMetric[metric];

    if (!structuredContent.hasData) {
        return [
            `Consultei ${metricLabel} da ${defaultFarmCode} via MCP ${mcpTool}/Atmos41.`,
            `Não encontrei pontos crus para a janela ${range.start} até ${range.stop}.`,
            structuredContent.emptyReason ??
                'Nenhum dado medido foi retornado pelo cache ambiental.',
        ].join(' ');
    }

    const points = windPointsFromStructuredContent(structuredContent);
    const firstPoint = points[0];
    const latestPoint = points.at(-1);

    if (!firstPoint || !latestPoint) {
        return [
            `Consultei ${metricLabel} da ${defaultFarmCode} via MCP ${mcpTool}/Atmos41.`,
            'A resposta indicou dados disponíveis, mas nenhum ponto cru foi encontrado.',
        ].join(' ');
    }

    return [
        `Consultei ${metricLabel} da ${defaultFarmCode} via MCP ${mcpTool}/Atmos41.`,
        `Janela consultada: ${range.start} até ${range.stop}.`,
        `Encontrei ${points.length} ponto(s) cru(s) do InfluxDB, sem média/agregação.`,
        `Cache ambiental: ${structuredContent.payload.cache.source}, TTL ${structuredContent.payload.cache.ttlSeconds}s, stale=${structuredContent.payload.cache.stale}.`,
        pointLimit
            ? `Retornando ${selectedPoints.length} ponto(s) selecionado(s) em metadata.agentResult.selectedPoints.`
            : 'Informe pointLimit para receber pontos em metadata.agentResult.selectedPoints.',
        `Primeira leitura: ${firstPoint.value} ${firstPoint.unit} em ${firstPoint.time}.`,
        `Última leitura: ${latestPoint.value} ${latestPoint.unit} em ${latestPoint.time}.`,
        `Campo ${latestPoint.field}, origem ${latestPoint.source}.`,
    ].join(' ');
};

const createCurrentAnswerText = (
    metric: WindAgentMetric,
    structuredContent: WindCurrentStructuredContent,
): string => {
    const metricLabel = windMetricLabel[metric];
    const value = valueForExternalMetric(metric, structuredContent.payload.data.wind);
    const unit = unitForExternalMetric(metric, structuredContent.payload.query.units);
    const time = new Date(structuredContent.payload.data.dt * 1000).toISOString();
    const valueText = value === null ? 'indisponível' : `${value} ${unit}`;

    return [
        `Consultei ${metricLabel} atual da ${defaultFarmCode} via MCP smart_wind_current_weather/OpenWeather.`,
        `Leitura atual: ${valueText} em ${time}.`,
        `Cache ambiental: ${structuredContent.payload.cache.source}, TTL ${structuredContent.payload.cache.ttlSeconds}s, stale=${structuredContent.payload.cache.stale}.`,
    ].join(' ');
};

const selectForecasts = (
    forecasts: readonly WindForecastSummary[],
    forecastLimit: WindAgentPointLimit | undefined,
): readonly WindForecastSummary[] => {
    if (!forecastLimit) {
        return [];
    }

    if (forecastLimit === 'all') {
        return forecasts;
    }

    return forecasts.slice(0, forecastLimit);
};

const createForecastAnswerText = (
    metric: WindAgentMetric,
    structuredContent: WindForecastStructuredContent,
    selectedForecasts: readonly WindForecastSummary[],
    forecastLimit: WindAgentPointLimit | undefined,
): string => {
    const metricLabel = windMetricLabel[metric];
    const forecasts = forecastsFromStructuredContent(structuredContent);
    const unit = unitForExternalMetric(metric, structuredContent.payload.query.units);
    const availableValues = forecasts
        .map((forecast) => {
            if (metric === 'speed') return forecast.speed;
            if (metric === 'direction') return forecast.direction;

            return forecast.gust;
        })
        .filter((value): value is number => value !== null);
    const first = forecasts[0];
    const latest = forecasts.at(-1);
    const maxValue = availableValues.length > 0 ? Math.max(...availableValues) : null;

    return [
        `Consultei previsão de ${metricLabel} da ${defaultFarmCode} via MCP smart_wind_forecast/OpenWeather.`,
        `Encontrei ${forecasts.length} previsão(ões).`,
        first && latest ? `Janela prevista: ${first.time} até ${latest.time}.` : '',
        maxValue === null
            ? 'Não encontrei valores de vento para esta métrica.'
            : `Maior valor retornado: ${maxValue} ${unit}.`,
        `Cache ambiental: ${structuredContent.payload.cache.source}, TTL ${structuredContent.payload.cache.ttlSeconds}s, stale=${structuredContent.payload.cache.stale}.`,
        forecastLimit
            ? `Retornando ${selectedForecasts.length} previsão(ões) selecionada(s) em metadata.agentResult.selectedForecasts.`
            : 'Informe forecastLimit ou pointLimit para receber previsões em metadata.agentResult.selectedForecasts.',
    ]
        .filter(Boolean)
        .join(' ');
};

export const windMessageSendHandler: A2AMessageSendHandler = async (
    params,
    context: A2AMessageSendContext,
) => {
    const prompt = textFromMessage(params);
    const requestData = extractWindAgentRequestData(params);
    const metric = getWindAgentMetric(requestData);
    const action = getWindAgentAction(requestData);
    const source = getWindAgentSource(requestData);

    if (source === 'external' || action === 'current' || action === 'forecast') {
        const externalAction = action === 'forecast' ? 'forecast' : 'current';
        const externalSource = 'external' satisfies WindAgentSource;
        const mcpTool = mcpToolByExternalWindAction[externalAction];
        const mcpArguments = createWindExternalMcpArguments(requestData);
        const mcpResult = await environmentalMcpRegistry.callTool(mcpTool, mcpArguments, {
            env: context.env,
        });

        if (externalAction === 'forecast') {
            const structuredContent = windForecastStructuredContentSchema.parse(
                mcpResult.structuredContent,
            );
            const forecasts = forecastsFromStructuredContent(structuredContent);
            const forecastLimit = getWindForecastLimit(requestData);
            const selectedForecasts = selectForecasts(forecasts, forecastLimit);
            const message = createAgentMessage(
                createForecastAnswerText(
                    metric,
                    structuredContent,
                    selectedForecasts,
                    forecastLimit,
                ),
                {
                    agent: 'vento',
                    farmCode: defaultFarmCode,
                    receivedText: prompt,
                    dataSourcesEnabled: true,
                    protocol: 'a2a',
                    action: externalAction,
                    source: externalSource,
                    metric,
                    mcpTool,
                    mcpArguments,
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
                    agent: 'vento',
                    farmCode: defaultFarmCode,
                    protocol: 'a2a',
                    action: externalAction satisfies WindAgentAction,
                    source: externalSource,
                    metric,
                    mcpTool,
                    cacheSource: structuredContent.payload.cache.source,
                    cacheStale: structuredContent.payload.cache.stale,
                    cacheTtlSeconds: structuredContent.payload.cache.ttlSeconds,
                    forecastCount: forecasts.length,
                    selectedForecastCount: selectedForecasts.length,
                },
                [params.message],
            );
        }

        const structuredContent = windCurrentStructuredContentSchema.parse(
            mcpResult.structuredContent,
        );
        const wind = structuredContent.payload.data.wind;
        const current = {
            speed: wind?.speed ?? null,
            direction: wind?.deg ?? null,
            gust: wind?.gust ?? null,
            time: new Date(structuredContent.payload.data.dt * 1000).toISOString(),
            locationName: structuredContent.payload.data.name ?? null,
        };
        const message = createAgentMessage(createCurrentAnswerText(metric, structuredContent), {
            agent: 'vento',
            farmCode: defaultFarmCode,
            receivedText: prompt,
            dataSourcesEnabled: true,
            protocol: 'a2a',
            action: externalAction,
            source: externalSource,
            metric,
            mcpTool,
            mcpArguments,
            sourceKind: structuredContent.sourceKind,
            sourceSystem: structuredContent.sourceSystem,
            external: structuredContent.external,
            cacheKey: structuredContent.payload.key,
            cacheProvider: structuredContent.payload.provider,
            cache: structuredContent.payload.cache,
            current,
            farm: structuredContent.payload.farm,
            query: structuredContent.payload.query,
        });

        return createCompletedTask(
            message,
            {
                agent: 'vento',
                farmCode: defaultFarmCode,
                protocol: 'a2a',
                action: externalAction satisfies WindAgentAction,
                source: externalSource,
                metric,
                mcpTool,
                cacheSource: structuredContent.payload.cache.source,
                cacheStale: structuredContent.payload.cache.stale,
                cacheTtlSeconds: structuredContent.payload.cache.ttlSeconds,
            },
            [params.message],
        );
    }

    const mcpTool = mcpToolByWindMetric[metric];
    const mcpArguments = createWindMcpArguments(requestData);
    const mcpResult = await environmentalMcpRegistry.callTool(mcpTool, mcpArguments, {
        env: context.env,
    });
    const structuredContent = windMcpStructuredContentSchema.parse(mcpResult.structuredContent);
    const points = windPointsFromStructuredContent(structuredContent);
    const firstPoint = points[0] ?? null;
    const latestPoint = points.at(-1) ?? null;
    const pointLimit = getWindPointLimit(requestData);
    const selectedPoints = selectPoints(points, pointLimit);
    const message = createAgentMessage(
        createAnswerText(metric, structuredContent, selectedPoints, pointLimit),
        {
            agent: 'vento',
            farmCode: defaultFarmCode,
            receivedText: prompt,
            dataSourcesEnabled: true,
            protocol: 'a2a',
            action,
            source,
            metric,
            mcpTool,
            mcpArguments,
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
            firstPoint,
            latestPoint,
            pointLimit: pointLimit ?? null,
            selectedPointCount: selectedPoints.length,
            selectedPoints,
        },
    );

    return createCompletedTask(
        message,
        {
            agent: 'vento',
            farmCode: defaultFarmCode,
            protocol: 'a2a',
            action,
            source,
            metric,
            mcpTool,
            cacheSource: structuredContent.payload.cache.source,
            cacheStale: structuredContent.payload.cache.stale,
            cacheTtlSeconds: structuredContent.payload.cache.ttlSeconds,
            hasData: structuredContent.hasData,
            pointCount: points.length,
            selectedPointCount: selectedPoints.length,
        },
        [params.message],
    );
};
