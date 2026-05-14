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
    }),
});
type SoilMcpStructuredContent = z.infer<typeof soilMcpStructuredContentSchema>;

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

const latestPointFromStructuredContent = (structuredContent: SoilMcpStructuredContent) => {
    const points = structuredContent.payload.data.groups.flatMap((group) =>
        group.fields.flatMap((field) =>
            field.sources.flatMap((source) =>
                source.points.map((point) => ({
                    field: field.field,
                    unit: point.unit || field.unit,
                    source: source.groupByValue,
                    time: point.time,
                    value: point.value,
                })),
            ),
        ),
    );

    return points.sort((left, right) => right.time.localeCompare(left.time))[0];
};

const createAnswerText = (
    group: SoilAgentGroup,
    structuredContent: SoilMcpStructuredContent,
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

    const latestPoint = latestPointFromStructuredContent(structuredContent);

    if (!latestPoint) {
        return [
            `Consultei ${fieldLabelByGroup[group]} da ${defaultFarmCode} via MCP smart_soil_data/Teros12.`,
            'A resposta indicou dados disponíveis, mas nenhum ponto consolidado foi encontrado.',
        ].join(' ');
    }

    return [
        `Consultei ${fieldLabelByGroup[group]} da ${defaultFarmCode} via MCP smart_soil_data/Teros12.`,
        `Última leitura encontrada: ${latestPoint.value} ${latestPoint.unit} em ${latestPoint.time}.`,
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
    const message = createAgentMessage(
        createAnswerText(parsedMcpArguments.group, structuredContent),
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
            hasData: structuredContent.hasData,
            emptyReason: structuredContent.emptyReason,
            range: structuredContent.payload.data.range,
        },
    );

    return createCompletedTask(
        message,
        {
            agent: 'solo',
            farmCode: defaultFarmCode,
            protocol: 'a2a',
            mcpTool: 'smart_soil_data',
            hasData: structuredContent.hasData,
        },
        [params.message],
    );
};
