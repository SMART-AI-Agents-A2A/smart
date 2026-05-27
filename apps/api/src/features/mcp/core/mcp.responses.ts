import { z } from 'zod';
import type { McpToolCallResult } from './mcp.type';
import { mcpToolCallResultSchema } from './mcp.vo';

export const mcpSourceKindSchema = z.enum(['measured', 'external']);
export type McpSourceKind = z.infer<typeof mcpSourceKindSchema>;

export const mcpSourceSystemSchema = z.enum(['influxdb', 'openweather']);
export type McpSourceSystem = z.infer<typeof mcpSourceSystemSchema>;

const mcpDataEnvelopeBaseSchema = z.object({
    sourceKind: mcpSourceKindSchema,
    sourceSystem: mcpSourceSystemSchema,
    sourceLabel: z.string().min(1),
    farmCode: z.string().min(1),
    external: z.boolean(),
    payload: z.unknown(),
});

export const mcpMeasuredDataEnvelopeSchema = mcpDataEnvelopeBaseSchema.extend({
    sourceKind: z.literal('measured'),
    sourceSystem: z.literal('influxdb'),
    external: z.literal(false),
    sensor: z.string().min(1),
    hasData: z.boolean(),
    emptyReason: z.string().nullable(),
});
export type McpMeasuredDataEnvelope<TPayload = unknown> = Omit<
    z.infer<typeof mcpMeasuredDataEnvelopeSchema>,
    'payload'
> & {
    readonly payload: TPayload;
};

export const mcpExternalDataEnvelopeSchema = mcpDataEnvelopeBaseSchema.extend({
    sourceKind: z.literal('external'),
    sourceSystem: z.literal('openweather'),
    external: z.literal(true),
});
export type McpExternalDataEnvelope<TPayload = unknown> = Omit<
    z.infer<typeof mcpExternalDataEnvelopeSchema>,
    'payload'
> & {
    readonly payload: TPayload;
};

export const createMcpMeasuredDataEnvelope = <TPayload>(input: {
    readonly farmCode: string;
    readonly sensor: string;
    readonly payload: TPayload;
    readonly hasData: boolean;
    readonly emptyReason: string | null;
    readonly sourceLabel?: string;
}): McpMeasuredDataEnvelope<TPayload> => {
    const envelope: McpMeasuredDataEnvelope<TPayload> = {
        sourceKind: 'measured',
        sourceSystem: 'influxdb',
        sourceLabel: input.sourceLabel ?? 'Dados medidos pelos sensores da Fazenda NSAAB',
        farmCode: input.farmCode,
        sensor: input.sensor,
        external: false,
        hasData: input.hasData,
        emptyReason: input.emptyReason,
        payload: input.payload,
    };

    mcpMeasuredDataEnvelopeSchema.parse(envelope);

    return envelope;
};

export const createMcpExternalDataEnvelope = <TPayload>(input: {
    readonly farmCode: string;
    readonly payload: TPayload;
    readonly sourceLabel?: string;
}): McpExternalDataEnvelope<TPayload> => {
    const envelope: McpExternalDataEnvelope<TPayload> = {
        sourceKind: 'external',
        sourceSystem: 'openweather',
        sourceLabel: input.sourceLabel ?? 'Dados externos da API OpenWeather',
        farmCode: input.farmCode,
        external: true,
        payload: input.payload,
    };

    mcpExternalDataEnvelopeSchema.parse(envelope);

    return envelope;
};

export const createMcpJsonToolResult = (
    text: string,
    structuredContent: unknown,
): McpToolCallResult => {
    return mcpToolCallResultSchema.parse({
        content: [
            {
                type: 'text',
                text,
            },
            {
                type: 'json',
                data: structuredContent,
            },
        ],
        structuredContent,
    });
};

export const createMcpTextToolResult = (text: string): McpToolCallResult => {
    return mcpToolCallResultSchema.parse({
        content: [
            {
                type: 'text',
                text,
            },
        ],
    });
};
