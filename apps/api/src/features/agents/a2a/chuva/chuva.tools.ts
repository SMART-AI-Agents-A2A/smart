import { z } from 'zod';
import { defaultFarmCode, fluxDurationSchema, fluxTimeSchema } from '../../tools/influxdb';
import { forecastCountFromQuerySchema, openWeatherUnitsSchema } from '../../tools/openweather';
import type { MessageSendParams } from '../core';

export const rainAgentActionSchema = z.enum(['forecast', 'accumulated', 'risk']);
export type RainAgentAction = z.infer<typeof rainAgentActionSchema>;

export const rainAgentLimitSchema = z.union([z.literal('all'), z.number().int().min(1).max(500)]);
export type RainAgentLimit = z.infer<typeof rainAgentLimitSchema>;

export const rainAgentMetadataSchema = z
    .object({
        farmCode: z.literal(defaultFarmCode).optional(),
        action: rainAgentActionSchema.optional(),
        start: fluxTimeSchema.optional(),
        stop: fluxTimeSchema.optional(),
        every: fluxDurationSchema.optional(),
        pointLimit: rainAgentLimitSchema.optional(),
        units: openWeatherUnitsSchema.optional(),
        lang: z.string().min(2).max(8).optional(),
        cnt: forecastCountFromQuerySchema.optional(),
        forecastLimit: rainAgentLimitSchema.optional(),
    })
    .passthrough();
export type RainAgentMetadata = z.infer<typeof rainAgentMetadataSchema>;

export const rainAgentDataPartSchema = rainAgentMetadataSchema;
export type RainAgentDataPart = z.infer<typeof rainAgentDataPartSchema>;

export const rainAccumulatedMcpArgumentsSchema = z.object({
    farmCode: z.literal(defaultFarmCode),
    start: fluxTimeSchema,
    stop: fluxTimeSchema.optional(),
    every: fluxDurationSchema,
});
export type RainAccumulatedMcpArguments = z.infer<typeof rainAccumulatedMcpArgumentsSchema>;

export const rainForecastMcpArgumentsSchema = z.object({
    farmCode: z.literal(defaultFarmCode),
    units: openWeatherUnitsSchema,
    lang: z.string().min(2).max(8),
    cnt: forecastCountFromQuerySchema.optional(),
});
export type RainForecastMcpArguments = z.infer<typeof rainForecastMcpArgumentsSchema>;

export interface RainAgentRequestData {
    readonly metadata: RainAgentMetadata;
    readonly data: RainAgentDataPart;
}

export const extractRainAgentRequestData = (params: MessageSendParams): RainAgentRequestData => {
    const metadata = rainAgentMetadataSchema.parse(params.metadata);
    const dataPart = params.message.parts.find((part) => part.kind === 'data');
    const data = rainAgentDataPartSchema.parse(dataPart?.data ?? {});

    return {
        metadata,
        data,
    };
};

export const getRainAgentAction = (requestData: RainAgentRequestData): RainAgentAction | null => {
    return requestData.data.action ?? requestData.metadata.action ?? null;
};

export const createRainAccumulatedMcpArguments = (
    requestData: RainAgentRequestData,
): RainAccumulatedMcpArguments => {
    return rainAccumulatedMcpArgumentsSchema.parse({
        farmCode: defaultFarmCode,
        start: requestData.data.start ?? requestData.metadata.start ?? '-24h',
        stop: requestData.data.stop ?? requestData.metadata.stop,
        every: requestData.data.every ?? requestData.metadata.every ?? '1h',
    });
};

export const createRainForecastMcpArguments = (
    requestData: RainAgentRequestData,
): RainForecastMcpArguments => {
    return rainForecastMcpArgumentsSchema.parse({
        farmCode: defaultFarmCode,
        units: requestData.data.units ?? requestData.metadata.units ?? 'metric',
        lang: requestData.data.lang ?? requestData.metadata.lang ?? 'pt_br',
        cnt: requestData.data.cnt ?? requestData.metadata.cnt,
    });
};

export const getRainPointLimit = (requestData: RainAgentRequestData): RainAgentLimit | undefined =>
    requestData.data.pointLimit ?? requestData.metadata.pointLimit;

export const getRainForecastLimit = (
    requestData: RainAgentRequestData,
): RainAgentLimit | undefined =>
    requestData.data.forecastLimit ?? requestData.metadata.forecastLimit;
