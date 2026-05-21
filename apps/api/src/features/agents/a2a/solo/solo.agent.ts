import { z } from 'zod';
import { createEnvironmentalMcpRegistry } from '../../mcp';
import { defaultFarmCode } from '../../tools/influxdb';
import {
    createAgentMessage,
    createCompletedTask,
    createInputRequiredTask,
    type A2AMessageSendContext,
    type A2AMessageSendHandler,
    type MessageSendParams,
} from '../core';
import {
    createSoilMcpArguments,
    extractSoilAgentRequestData,
    soilAgentMcpArgumentsSchema,
    type SoilAgentGroup,
    type SoilAgentPointLimit,
} from './solo.tools';

const environmentalMcpRegistry = createEnvironmentalMcpRegistry();

const soilMcpStructuredContentSchema = z.object({
    sourceKind: z.literal('measured'),
    sourceSystem: z.literal('influxdb'),
    farmCode: z.literal(defaultFarmCode),
    sensor: z.literal('Teros12'),
    external: z.literal(false),
    hasData: z.boolean(),
    emptyReason: z.string().nullable(),
    payload: z.object({
        key: z.string().min(1),
        provider: z.literal('influxdb'),
        data: z.object({
            sensor: z.literal('Teros12'),
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
type SoilMcpStructuredContent = z.infer<typeof soilMcpStructuredContentSchema>;

interface SoilPointSummary {
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

const fieldLabelByGroup: Record<SoilAgentGroup, string> = {
    'Umidade do Solo': 'umidade do solo',
    'Temperatura do Solo': 'temperatura do solo',
    'Condutividade Elétrica': 'condutividade elétrica do solo',
};

const pointsFromStructuredContent = (
    structuredContent: SoilMcpStructuredContent,
): readonly SoilPointSummary[] => {
    return structuredContent.payload.data.groups
        .flatMap((group) =>
            group.fields.flatMap((field) =>
                field.sources.flatMap((source) =>
                    source.points.map(
                        (point): SoilPointSummary => ({
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
    points: readonly SoilPointSummary[],
    pointLimit: SoilAgentPointLimit | undefined,
): readonly SoilPointSummary[] => {
    if (!pointLimit) {
        return [];
    }

    if (pointLimit === 'all') {
        return points;
    }

    return points.slice(-pointLimit);
};

const createAnswerText = (
    group: SoilAgentGroup,
    structuredContent: SoilMcpStructuredContent,
    selectedPoints: readonly SoilPointSummary[],
    pointLimit: SoilAgentPointLimit | undefined,
): string => {
    const range = structuredContent.payload.data.range;

    if (!structuredContent.hasData) {
        return [
            `Consultei ${fieldLabelByGroup[group]} da ${defaultFarmCode} via MCP smart_soil_data/Teros12.`,
            `Não encontrei séries para a janela ${range.start} até ${range.stop}.`,
            structuredContent.emptyReason ??
                'Nenhum dado medido foi retornado pelo cache ambiental.',
        ].join(' ');
    }

    const points = pointsFromStructuredContent(structuredContent);
    const firstPoint = points[0];
    const latestPoint = points.at(-1);

    if (!firstPoint || !latestPoint) {
        return [
            `Consultei ${fieldLabelByGroup[group]} da ${defaultFarmCode} via MCP smart_soil_data/Teros12.`,
            'A resposta indicou dados disponíveis, mas nenhum ponto consolidado foi encontrado.',
        ].join(' ');
    }

    return [
        `Consultei ${fieldLabelByGroup[group]} da ${defaultFarmCode} via MCP smart_soil_data/Teros12.`,
        `Janela consultada: ${range.start} até ${range.stop}, agregado a cada ${range.every}.`,
        `Encontrei ${points.length} ponto(s) consolidado(s).`,
        `Cache ambiental: ${structuredContent.payload.cache.source}, TTL ${structuredContent.payload.cache.ttlSeconds}s, stale=${structuredContent.payload.cache.stale}.`,
        pointLimit
            ? `Retornando ${selectedPoints.length} ponto(s) selecionado(s) em metadata.agentResult.selectedPoints.`
            : 'Informe pointLimit para receber pontos em metadata.agentResult.selectedPoints.',
        `Primeira leitura: ${firstPoint.value} ${firstPoint.unit} em ${firstPoint.time}.`,
        `Última leitura: ${latestPoint.value} ${latestPoint.unit} em ${latestPoint.time}.`,
        `Campo ${latestPoint.field}, origem ${latestPoint.source}.`,
    ].join(' ');
};

export const soilMessageSendHandler: A2AMessageSendHandler = async (
    params,
    context: A2AMessageSendContext,
) => {
    const prompt = textFromMessage(params);
    const requestData = extractSoilAgentRequestData(params);
    const mcpArguments = createSoilMcpArguments(requestData);

    if (!mcpArguments) {
        const message = createAgentMessage(
            [
                'Para consultar dados de solo via A2A, informe o grupo de solo em metadata.group ou em uma data part.',
                'Grupos aceitos: Umidade do Solo, Temperatura do Solo, Condutividade Elétrica.',
            ].join(' '),
            {
                agent: 'solo',
                farmCode: defaultFarmCode,
                receivedText: prompt,
                protocol: 'a2a',
                requiredInput: {
                    field: 'group',
                    allowedValues: [
                        'Umidade do Solo',
                        'Temperatura do Solo',
                        'Condutividade Elétrica',
                    ],
                },
            },
        );

        return createInputRequiredTask(
            message,
            {
                agent: 'solo',
                farmCode: defaultFarmCode,
                protocol: 'a2a',
                requiredInput: 'group',
            },
            [params.message],
        );
    }

    const parsedMcpArguments = soilAgentMcpArgumentsSchema.parse(mcpArguments);
    const mcpResult = await environmentalMcpRegistry.callTool(
        'smart_soil_data',
        parsedMcpArguments,
        {
            env: context.env,
        },
    );
    const structuredContent = soilMcpStructuredContentSchema.parse(mcpResult.structuredContent);
    const points = pointsFromStructuredContent(structuredContent);
    const firstPoint = points[0] ?? null;
    const latestPoint = points.at(-1) ?? null;
    const pointLimit = requestData.data.pointLimit ?? requestData.metadata.pointLimit;
    const selectedPoints = selectPoints(points, pointLimit);
    const message = createAgentMessage(
        createAnswerText(parsedMcpArguments.group, structuredContent, selectedPoints, pointLimit),
        {
            agent: 'solo',
            farmCode: defaultFarmCode,
            receivedText: prompt,
            dataSourcesEnabled: true,
            protocol: 'a2a',
            mcpTool: 'smart_soil_data',
            mcpArguments: parsedMcpArguments,
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
            agent: 'solo',
            farmCode: defaultFarmCode,
            protocol: 'a2a',
            mcpTool: 'smart_soil_data',
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
