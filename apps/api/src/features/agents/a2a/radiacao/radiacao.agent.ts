import { z } from 'zod';
import { createEnvironmentalMcpRegistry } from '../../mcp';
import { defaultFarmCode } from '../../tools/influxdb';
import {
    createAgentMessage,
    createCompletedTask,
    type A2AMessageSendContext,
    type A2AMessageSendHandler,
    type MessageSendParams,
} from '../core';
import {
    createRadiationSolarMcpArguments,
    extractRadiationAgentRequestData,
    getRadiationPointLimit,
    type RadiationAgentPointLimit,
} from './radiacao.tools';

const environmentalMcpRegistry = createEnvironmentalMcpRegistry();

const radiationSolarStructuredContentSchema = z.object({
    sourceKind: z.literal('measured'),
    sourceSystem: z.literal('influxdb'),
    farmCode: z.literal(defaultFarmCode),
    sensor: z.literal('Atmos41'),
    external: z.literal(false),
    hasData: z.boolean(),
    emptyReason: z.string().nullable(),
    payload: z.object({
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
    }),
});
type RadiationSolarStructuredContent = z.infer<typeof radiationSolarStructuredContentSchema>;

interface RadiationPointSummary {
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

const radiationPointsFromStructuredContent = (
    structuredContent: RadiationSolarStructuredContent,
): readonly RadiationPointSummary[] => {
    return structuredContent.payload.data.groups
        .flatMap((group) =>
            group.fields.flatMap((field) =>
                field.sources.flatMap((source) =>
                    source.points.map(
                        (point): RadiationPointSummary => ({
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
    points: readonly RadiationPointSummary[],
    pointLimit: RadiationAgentPointLimit | undefined,
): readonly RadiationPointSummary[] => {
    if (!pointLimit) {
        return [];
    }

    if (pointLimit === 'all') {
        return points;
    }

    return points.slice(-pointLimit);
};

const createAnswerText = (
    structuredContent: RadiationSolarStructuredContent,
    selectedPoints: readonly RadiationPointSummary[],
    pointLimit: RadiationAgentPointLimit | undefined,
): string => {
    const range = structuredContent.payload.data.range;

    if (!structuredContent.hasData) {
        return [
            `Consultei radiação solar da ${defaultFarmCode} via MCP smart_radiation_solar/Atmos41.`,
            `Não encontrei séries para a janela ${range.start} até ${range.stop}.`,
            structuredContent.emptyReason ??
                'Nenhum dado medido foi retornado pelo cache ambiental.',
        ].join(' ');
    }

    const points = radiationPointsFromStructuredContent(structuredContent);
    const firstPoint = points[0];
    const latestPoint = points.at(-1);

    if (!firstPoint || !latestPoint) {
        return [
            `Consultei radiação solar da ${defaultFarmCode} via MCP smart_radiation_solar/Atmos41.`,
            'A resposta indicou dados disponíveis, mas nenhum ponto consolidado foi encontrado.',
        ].join(' ');
    }

    return [
        `Consultei radiação solar da ${defaultFarmCode} via MCP smart_radiation_solar/Atmos41.`,
        `Janela consultada: ${range.start} até ${range.stop}, agregado a cada ${range.every}.`,
        `Encontrei ${points.length} ponto(s) consolidado(s).`,
        pointLimit
            ? `Retornando ${selectedPoints.length} ponto(s) selecionado(s) em metadata.agentResult.selectedPoints.`
            : 'Informe pointLimit para receber pontos em metadata.agentResult.selectedPoints.',
        `Primeira leitura: ${firstPoint.value} ${firstPoint.unit} em ${firstPoint.time}.`,
        `Última leitura: ${latestPoint.value} ${latestPoint.unit} em ${latestPoint.time}.`,
        `Campo ${latestPoint.field}, origem ${latestPoint.source}.`,
    ].join(' ');
};

export const radiationMessageSendHandler: A2AMessageSendHandler = async (
    params,
    context: A2AMessageSendContext,
) => {
    const prompt = textFromMessage(params);
    const requestData = extractRadiationAgentRequestData(params);
    const mcpArguments = createRadiationSolarMcpArguments(requestData);
    const mcpResult = await environmentalMcpRegistry.callTool(
        'smart_radiation_solar',
        mcpArguments,
        {
            env: context.env,
        },
    );
    const structuredContent = radiationSolarStructuredContentSchema.parse(
        mcpResult.structuredContent,
    );
    const points = radiationPointsFromStructuredContent(structuredContent);
    const firstPoint = points[0] ?? null;
    const latestPoint = points.at(-1) ?? null;
    const pointLimit = getRadiationPointLimit(requestData);
    const selectedPoints = selectPoints(points, pointLimit);
    const message = createAgentMessage(
        createAnswerText(structuredContent, selectedPoints, pointLimit),
        {
            agent: 'radiacao',
            farmCode: defaultFarmCode,
            receivedText: prompt,
            dataSourcesEnabled: true,
            protocol: 'a2a',
            mcpTool: 'smart_radiation_solar',
            mcpArguments,
            sourceKind: structuredContent.sourceKind,
            sourceSystem: structuredContent.sourceSystem,
            sensor: structuredContent.sensor,
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
            agent: 'radiacao',
            farmCode: defaultFarmCode,
            protocol: 'a2a',
            mcpTool: 'smart_radiation_solar',
            hasData: structuredContent.hasData,
            pointCount: points.length,
            selectedPointCount: selectedPoints.length,
        },
        [params.message],
    );
};
