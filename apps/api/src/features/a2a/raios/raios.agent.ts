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
    createLightningMcpArguments,
    extractLightningAgentRequestData,
    getLightningAgentMetric,
    getLightningPointLimit,
    lightningMetricLabel,
    mcpToolByLightningMetric,
    type LightningAgentMetric,
    type LightningAgentPointLimit,
} from './raios.tools';

const environmentalMcpRegistry = createEnvironmentalMcpRegistry();

const lightningMcpStructuredContentSchema = z.object({
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
type LightningMcpStructuredContent = z.infer<typeof lightningMcpStructuredContentSchema>;

interface LightningPointSummary {
    readonly field: string;
    readonly unit: string;
    readonly source: string;
    readonly time: string;
    readonly value: number;
}

interface LightningRiskSummary {
    readonly level: 'baixo' | 'moderado' | 'alto';
    readonly totalStrikes: number;
    readonly minimumDistanceKm: number | null;
}

const textFromMessage = (params: MessageSendParams): string => {
    return params.message.parts
        .filter((part) => part.kind === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim();
};

const lightningPointsFromStructuredContent = (
    structuredContent: LightningMcpStructuredContent,
): readonly LightningPointSummary[] => {
    return structuredContent.payload.data.groups
        .flatMap((group) =>
            group.fields.flatMap((field) =>
                field.sources.flatMap((source) =>
                    source.points.map(
                        (point): LightningPointSummary => ({
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
    points: readonly LightningPointSummary[],
    pointLimit: LightningAgentPointLimit | undefined,
): readonly LightningPointSummary[] => {
    if (!pointLimit) {
        return [];
    }

    if (pointLimit === 'all') {
        return points;
    }

    return points.slice(-pointLimit);
};

const latestByField = (points: readonly LightningPointSummary[]) => {
    const latest = new Map<string, LightningPointSummary>();

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

const createRiskSummary = (points: readonly LightningPointSummary[]): LightningRiskSummary => {
    const totalStrikes = points
        .filter((point) => point.field === 'LightningStrikes')
        .reduce((sum, point) => sum + point.value, 0);
    const distances = points
        .filter((point) => point.field === 'LightningDistance')
        .map((point) => point.value);
    const minimumDistanceKm = distances.length > 0 ? Math.min(...distances) : null;
    const level =
        totalStrikes >= 5 || (minimumDistanceKm !== null && minimumDistanceKm <= 10)
            ? 'alto'
            : totalStrikes > 0 || (minimumDistanceKm !== null && minimumDistanceKm <= 20)
              ? 'moderado'
              : 'baixo';

    return {
        level,
        totalStrikes,
        minimumDistanceKm,
    };
};

const createAnswerText = (
    metric: LightningAgentMetric,
    structuredContent: LightningMcpStructuredContent,
    points: readonly LightningPointSummary[],
    selectedPoints: readonly LightningPointSummary[],
    pointLimit: LightningAgentPointLimit | undefined,
): string => {
    const range = structuredContent.payload.data.range;
    const metricLabel = lightningMetricLabel[metric];
    const mcpTool = mcpToolByLightningMetric[metric];

    if (!structuredContent.hasData || points.length === 0) {
        return [
            `Consultei ${metricLabel} da ${defaultFarmCode} via MCP ${mcpTool}/Atmos41.`,
            `Não encontrei pontos crus para a janela ${range.start} até ${range.stop}.`,
            structuredContent.emptyReason ??
                'Nenhum dado medido foi retornado pelo cache ambiental.',
            `Cache ambiental: ${structuredContent.payload.cache.source}, TTL ${structuredContent.payload.cache.ttlSeconds}s, stale=${structuredContent.payload.cache.stale}.`,
        ].join(' ');
    }

    const firstPoint = points[0];
    const latestPoint = points.at(-1);
    const risk = createRiskSummary(points);
    const riskText =
        metric === 'risk'
            ? `Risco estimado: ${risk.level}. Total de descargas: ${risk.totalStrikes}. Distância mínima: ${risk.minimumDistanceKm ?? 'indisponível'} km.`
            : '';

    return [
        `Consultei ${metricLabel} da ${defaultFarmCode} via MCP ${mcpTool}/Atmos41.`,
        `Janela consultada: ${range.start} até ${range.stop}.`,
        `Encontrei ${points.length} ponto(s) cru(s) do InfluxDB, sem média/agregação.`,
        riskText,
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

export const lightningMessageSendHandler: A2AMessageSendHandler = async (
    params,
    context: A2AMessageSendContext,
) => {
    const prompt = textFromMessage(params);
    const requestData = extractLightningAgentRequestData(params);
    const metric = getLightningAgentMetric(requestData);
    const mcpTool = mcpToolByLightningMetric[metric];
    const mcpArguments = createLightningMcpArguments(requestData);
    const mcpResult = await environmentalMcpRegistry.callTool(mcpTool, mcpArguments, {
        env: context.env,
    });
    const structuredContent = lightningMcpStructuredContentSchema.parse(
        mcpResult.structuredContent,
    );
    const points = lightningPointsFromStructuredContent(structuredContent);
    const firstPoint = points[0] ?? null;
    const latestPoint = points.at(-1) ?? null;
    const pointLimit = getLightningPointLimit(requestData);
    const selectedPoints = selectPoints(points, pointLimit);
    const risk = createRiskSummary(points);
    const message = createAgentMessage(
        createAnswerText(metric, structuredContent, points, selectedPoints, pointLimit),
        {
            agent: 'raio',
            farmCode: defaultFarmCode,
            receivedText: prompt,
            dataSourcesEnabled: true,
            protocol: 'a2a',
            action: 'measured',
            source: 'sensor',
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
            latestByField: latestByField(points),
            risk: metric === 'risk' ? risk : undefined,
            pointLimit: pointLimit ?? null,
            selectedPointCount: selectedPoints.length,
            selectedPoints,
        },
    );

    return createCompletedTask(
        message,
        {
            agent: 'raio',
            farmCode: defaultFarmCode,
            protocol: 'a2a',
            action: 'measured',
            source: 'sensor',
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
