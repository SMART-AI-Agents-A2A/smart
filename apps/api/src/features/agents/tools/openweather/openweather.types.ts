import type { Context } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { z, type ZodError } from 'zod';
import type { CacheMetadata } from '../cache';

type AppEnv = {
    Bindings: CloudflareBindings;
};

type AppContext = Context<AppEnv>;

export interface ValidationIssue {
    readonly path: string;
    readonly message: string;
}

export interface DataResponse<TData> {
    readonly success: true;
    readonly data: TData;
}

export interface ErrorResponse {
    readonly success: false;
    readonly message: string;
    readonly issues?: readonly ValidationIssue[];
}

export const forecastCountFromQuerySchema = z.preprocess((value) => {
    if (typeof value !== 'string') {
        return value;
    }

    const parsed = Number(value);

    return Number.isInteger(parsed) ? parsed : value;
}, z.number().int().min(1).max(40));

export const openWeatherEnvSchema = z.object({
    OPENWEATHER_URL: z.string().url().default('https://api.openweathermap.org/data/2.5'),

    OPENWEATHER_API: z.string().min(1),
});

export const openWeatherUnitsSchema = z.enum(['standard', 'metric', 'imperial']);

export const openWeatherQuerySchema = z.object({
    units: openWeatherUnitsSchema.default('metric'),
    lang: z.string().min(2).max(8).default('pt_br'),
    cnt: forecastCountFromQuerySchema.optional(),
});

export const openWeatherWeatherItemSchema = z.object({
    id: z.number(),
    main: z.string(),
    description: z.string(),
    icon: z.string(),
});

export const openWeatherMainSchema = z.object({
    temp: z.number(),
    feels_like: z.number().optional(),
    temp_min: z.number().optional(),
    temp_max: z.number().optional(),
    pressure: z.number().optional(),
    humidity: z.number().optional(),
    sea_level: z.number().optional(),
    grnd_level: z.number().optional(),
});

export const openWeatherWindSchema = z
    .object({
        speed: z.number().optional(),
        deg: z.number().optional(),
        gust: z.number().optional(),
    })
    .optional();

export const openWeatherCloudsSchema = z
    .object({
        all: z.number().optional(),
    })
    .optional();

export const openWeatherCurrentResponseSchema = z
    .object({
        coord: z
            .object({
                lon: z.number(),
                lat: z.number(),
            })
            .optional(),
        weather: z.array(openWeatherWeatherItemSchema),
        base: z.string().optional(),
        main: openWeatherMainSchema,
        visibility: z.number().optional(),
        wind: openWeatherWindSchema,
        clouds: openWeatherCloudsSchema,
        rain: z.record(z.string(), z.number()).optional(),
        snow: z.record(z.string(), z.number()).optional(),
        dt: z.number(),
        timezone: z.number().optional(),
        id: z.number().optional(),
        name: z.string().optional(),
        cod: z.union([z.number(), z.string()]).optional(),
    })
    .passthrough();

export const openWeatherForecastItemSchema = z
    .object({
        dt: z.number(),
        main: openWeatherMainSchema,
        weather: z.array(openWeatherWeatherItemSchema),
        clouds: openWeatherCloudsSchema,
        wind: openWeatherWindSchema,
        visibility: z.number().optional(),
        pop: z.number().optional(),
        rain: z.record(z.string(), z.number()).optional(),
        snow: z.record(z.string(), z.number()).optional(),
        sys: z
            .object({
                pod: z.string().optional(),
            })
            .optional(),
        dt_txt: z.string().optional(),
    })
    .passthrough();

export const openWeatherForecastResponseSchema = z
    .object({
        cod: z.union([z.string(), z.number()]),
        message: z.union([z.string(), z.number()]).optional(),
        cnt: z.number().optional(),
        list: z.array(openWeatherForecastItemSchema),
        city: z
            .object({
                id: z.number().optional(),
                name: z.string().optional(),
                country: z.string().optional(),
                coord: z
                    .object({
                        lat: z.number().optional(),
                        lon: z.number().optional(),
                    })
                    .optional(),
                population: z.number().optional(),
                timezone: z.number().optional(),
                sunrise: z.number().optional(),
                sunset: z.number().optional(),
            })
            .optional(),
    })
    .passthrough();

export type OpenWeatherEnv = z.infer<typeof openWeatherEnvSchema>;

export type OpenWeatherUnits = z.infer<typeof openWeatherUnitsSchema>;

export type OpenWeatherQuery = z.infer<typeof openWeatherQuerySchema>;

export type OpenWeatherCurrentResponse = z.infer<typeof openWeatherCurrentResponseSchema>;

export type OpenWeatherForecastItem = z.infer<typeof openWeatherForecastItemSchema>;

export type OpenWeatherForecastResponse = z.infer<typeof openWeatherForecastResponseSchema>;

export type GeoJsonPosition = readonly [number, number];

export interface OpenWeatherFarmLocation {
    readonly name: string;
    readonly latitude: number;
    readonly longitude: number;
    readonly bbox: {
        readonly minLatitude: number;
        readonly minLongitude: number;
        readonly maxLatitude: number;
        readonly maxLongitude: number;
    };
    readonly geojsonFeatures: number;
}

export interface OpenWeatherCurrentPayload {
    readonly source: 'openweather';
    readonly type: 'current';
    readonly farm: OpenWeatherFarmLocation;
    readonly query: OpenWeatherQuery;
    readonly weather: OpenWeatherCurrentResponse;
    readonly cache: CacheMetadata;
}

export interface OpenWeatherForecastPayload {
    readonly source: 'openweather';
    readonly type: 'forecast';
    readonly farm: OpenWeatherFarmLocation;
    readonly query: OpenWeatherQuery;
    readonly forecast: OpenWeatherForecastResponse;
    readonly cache: CacheMetadata;
}

export interface OpenWeatherSummaryPayload {
    readonly source: 'openweather';
    readonly type: 'summary';
    readonly farm: OpenWeatherFarmLocation;
    readonly query: OpenWeatherQuery;
    readonly current: OpenWeatherCurrentResponse;
    readonly forecast: OpenWeatherForecastResponse;
    readonly cache: CacheMetadata;
}

type ZodValidationResult<TData> =
    | {
          readonly success: true;
          readonly data: TData;
      }
    | {
          readonly success: false;
          readonly response: Response;
      };

export const zodIssuesToValidationIssues = (error: ZodError): readonly ValidationIssue[] => {
    return error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || 'root',
        message: issue.message,
    }));
};

const zodBadRequest = (c: AppContext, message: string, error: ZodError): Response => {
    return c.json<ErrorResponse>(
        {
            success: false,
            message,
            issues: zodIssuesToValidationIssues(error),
        },
        StatusCodes.BAD_REQUEST,
    );
};

export const validateOpenWeatherQuery = (c: AppContext): ZodValidationResult<OpenWeatherQuery> => {
    const result = openWeatherQuerySchema.safeParse(c.req.query());

    if (!result.success) {
        return {
            success: false,
            response: zodBadRequest(c, 'Query inválida para consultar OpenWeather.', result.error),
        };
    }

    return {
        success: true,
        data: result.data,
    };
};

export const parseOpenWeatherEnv = (rawEnv: unknown): OpenWeatherEnv => {
    return openWeatherEnvSchema.parse(rawEnv);
};
