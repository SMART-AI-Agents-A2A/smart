import { z } from 'zod';
import { createEnvironmentalMcpRegistry } from '../../mcp';
import { defaultFarmCode } from '../../influxdb/influxdb.vo';
import {
    createAgentMessage,
    createCompletedTask,
    type A2AMessageSendContext,
    type A2AMessageSendHandler,
    type MessageSendParams,
} from '../core';
import {
    airMetricLabel,
    createAirExternalMcpArguments,
    createAirMcpArguments,
    extractAirAgentRequestData,
    getAirAgentAction,
    getAirAgentMetric,
    getAirAgentSource,
    getAirPointLimit,
    mcpToolByAirMetric,
    type AirAgentAction,
    type AirAgentMetric,
    type AirAgentPointLimit,
    type AirAgentSource,
} from './ar.tools';

const environmentalMcpRegistry = createEnvironmentalMcpRegistry();

const airMcpStructuredContentSchema = z.object({
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
type AirMcpStructuredContent = z.infer<typeof airMcpStructuredContentSchema>;

const airExternalStructuredContentSchema = z.object({
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
            weather: z.array(
                z.object({
                    main: z.string(),
                    description: z.string(),
                }),
            ),
            main: z.object({
                temp: z.number(),
                feels_like: z.number().optional(),
                pressure: z.number().optional(),
                humidity: z.number().optional(),
            }),
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
type AirExternalStructuredContent = z.infer<typeof airExternalStructuredContentSchema>;

interface AirPointSummary {
    readonly field: string;
    readonly unit: string;
    readonly source: string;
    readonly time: string;
    readonly value: number;
}

const textFromMessage = (params: MessageSendParams): string => {
    return params.message.parts
        .filter((part) => part.kind === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim();
};

const pointsFromStructuredContent = (
    structuredContent: AirMcpStructuredContent,
): readonly AirPointSummary[] => {
    return structuredContent.payload.data.groups
        .flatMap((group) =>
            group.fields.flatMap((field) =>
                field.sources.flatMap((source) =>
                    source.points.map(
                        (point): AirPointSummary => ({
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
    points: readonly AirPointSummary[],
    pointLimit: AirAgentPointLimit | undefined,
): readonly AirPointSummary[] => {
    if (!pointLimit) return [];

    if (pointLimit === 'all') return points;

    return points.slice(-pointLimit);
};

const latestByField = (points: readonly AirPointSummary[]) => {
    const latest = new Map<string, AirPointSummary>();

    for (const point of points) {
        latest.set(point.field, point);
    }

    return Object.fromEntries(
        [...latest.entries()].map(([field, point]) => [
            field,
            {
                value: point.value,
                unit: point.unit,
                time: point.time,
                source: point.source,
            },
        ]),
    );
};

const createSensorAnswerText = (
    metric: AirAgentMetric,
    structuredContent: AirMcpStructuredContent,
    points: readonly AirPointSummary[],
): string => {
    const metricLabel = airMetricLabel[metric];
    const range = structuredContent.payload.data.range;

    if (!structuredContent.hasData || points.length === 0) {
        return `Consultei ${metricLabel} da ${defaultFarmCode} pelo sensor Atmos41, mas não encontrei séries para ${range.start} até ${range.stop}. Cache ambiental: ${structuredContent.payload.cache.source}, TTL ${structuredContent.payload.cache.ttlSeconds}s, stale=${structuredContent.payload.cache.stale}.`;
    }

    const latest = latestByField(points);

    if (metric === 'conditions') {
        const fields = Object.entries(latest)
            .map(([field, point]) => `${field}: ${point.value} ${point.unit}`)
            .join('; ');

        return `Consultei condições gerais do ar da ${defaultFarmCode} pelo sensor Atmos41. Últimas leituras: ${fields}. Cache ambiental: ${structuredContent.payload.cache.source}, TTL ${structuredContent.payload.cache.ttlSeconds}s, stale=${structuredContent.payload.cache.stale}.`;
    }

    const point = points.at(-1);

    return `Consultei ${metricLabel} da ${defaultFarmCode} pelo sensor Atmos41. Última leitura: ${point?.value} ${point?.unit} em ${point?.time}. Cache ambiental: ${structuredContent.payload.cache.source}, TTL ${structuredContent.payload.cache.ttlSeconds}s, stale=${structuredContent.payload.cache.stale}.`;
};

const externalValueForMetric = (
    metric: AirAgentMetric,
    structuredContent: AirExternalStructuredContent,
): string => {
    const current = structuredContent.payload.data;
    const description = current.weather[0]?.description ?? 'sem descrição';

    if (metric === 'temperature') {
        return `${current.main.temp} °C`;
    }

    if (metric === 'humidity') {
        return current.main.humidity === undefined ? 'indisponível' : `${current.main.humidity}%`;
    }

    if (metric === 'pressure') {
        return current.main.pressure === undefined
            ? 'indisponível'
            : `${current.main.pressure} hPa`;
    }

    return [
        `${current.main.temp} °C`,
        current.main.humidity === undefined ? null : `${current.main.humidity}% umidade`,
        current.main.pressure === undefined ? null : `${current.main.pressure} hPa`,
        description,
    ]
        .filter(Boolean)
        .join(', ');
};

const createExternalAnswerText = (
    metric: AirAgentMetric,
    structuredContent: AirExternalStructuredContent,
): string => {
    const metricLabel = airMetricLabel[metric];
    const current = structuredContent.payload.data;
    const time = new Date(current.dt * 1000).toISOString();

    return `Consultei ${metricLabel} da ${defaultFarmCode} pela API externa OpenWeather. Leitura atual: ${externalValueForMetric(metric, structuredContent)} em ${time}. Cache ambiental: ${structuredContent.payload.cache.source}, TTL ${structuredContent.payload.cache.ttlSeconds}s, stale=${structuredContent.payload.cache.stale}.`;
};

export const airMessageSendHandler: A2AMessageSendHandler = async (
    params,
    context: A2AMessageSendContext,
) => {
    const prompt = textFromMessage(params);
    const requestData = extractAirAgentRequestData(params);
    const action = getAirAgentAction(requestData);
    const metric = getAirAgentMetric(requestData);
    const source = getAirAgentSource(requestData);

    if (action === 'current') {
        const mcpTool = 'smart_air_current_weather';
        const mcpArguments = createAirExternalMcpArguments(requestData);
        const mcpResult = await environmentalMcpRegistry.callTool(mcpTool, mcpArguments, {
            env: context.env,
        });
        const structuredContent = airExternalStructuredContentSchema.parse(
            mcpResult.structuredContent,
        );
        const current = structuredContent.payload.data;
        const currentTime = new Date(current.dt * 1000).toISOString();
        const currentSummary = {
            temperature: current.main.temp,
            feelsLike: current.main.feels_like ?? null,
            humidity: current.main.humidity ?? null,
            pressure: current.main.pressure ?? null,
            description: current.weather[0]?.description ?? null,
            main: current.weather[0]?.main ?? null,
            locationName: current.name ?? null,
            time: currentTime,
        };
        const message = createAgentMessage(createExternalAnswerText(metric, structuredContent), {
            agent: 'ar',
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
            external: structuredContent.external,
            cacheKey: structuredContent.payload.key,
            cacheProvider: structuredContent.payload.provider,
            cache: structuredContent.payload.cache,
            current: currentSummary,
            farm: structuredContent.payload.farm,
            query: structuredContent.payload.query,
        });

        return createCompletedTask(
            message,
            {
                agent: 'ar',
                farmCode: defaultFarmCode,
                protocol: 'a2a',
                action: action satisfies AirAgentAction,
                source: source satisfies AirAgentSource,
                metric,
                mcpTool,
                cacheSource: structuredContent.payload.cache.source,
                cacheStale: structuredContent.payload.cache.stale,
                cacheTtlSeconds: structuredContent.payload.cache.ttlSeconds,
            },
            [params.message],
        );
    }

    const mcpTool = mcpToolByAirMetric[metric];
    const mcpArguments = createAirMcpArguments(requestData);
    const mcpResult = await environmentalMcpRegistry.callTool(mcpTool, mcpArguments, {
        env: context.env,
    });
    const structuredContent = airMcpStructuredContentSchema.parse(mcpResult.structuredContent);
    const points = pointsFromStructuredContent(structuredContent);
    const firstPoint = points[0] ?? null;
    const latestPoint = points.at(-1) ?? null;
    const pointLimit = getAirPointLimit(requestData);
    const selectedPoints = selectPoints(points, pointLimit);
    const message = createAgentMessage(createSensorAnswerText(metric, structuredContent, points), {
        agent: 'ar',
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
        latestByField: metric === 'conditions' ? latestByField(points) : undefined,
        pointLimit: pointLimit ?? null,
        selectedPointCount: selectedPoints.length,
        selectedPoints,
    });

    return createCompletedTask(
        message,
        {
            agent: 'ar',
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
