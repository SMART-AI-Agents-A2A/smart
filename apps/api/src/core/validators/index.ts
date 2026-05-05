import type { Context } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import type { MessageResponse, MessageWithErrorsResponse } from '../../shared/types/responses';

export function validateContentType(contentTypeToValidate: string) {
    return (
        value: Record<string, string | undefined>,
        c: Context,
    ): Record<string, string | undefined> | Response => {
        const contentType = value['content-type'];

        if (!contentType?.includes(contentTypeToValidate)) {
            return c.json(
                {
                    success: false,
                    message: 'Content-type inválido.',
                } as MessageResponse,
                StatusCodes.UNSUPPORTED_MEDIA_TYPE,
            );
        }

        return value;
    };
}

export function validateJsonContent<T>(safeParse: (data: unknown) => z.ZodSafeParseResult<T>) {
    return (value: Record<string, string | undefined>, c: Context): T | Response => {
        if (!value) {
            return c.json(
                {
                    success: false,
                    message: 'Sem dados.',
                } as MessageResponse,
                StatusCodes.BAD_REQUEST,
            );
        }

        const validatedPayload = safeParse(value);

        if (!validatedPayload.success) {
            const errorMessages = validatedPayload.error.issues.map((err) => ({
                path: err.path.join('.'),
                message: err.message,
            }));

            return c.json(
                {
                    success: false,
                    message: 'Dados inválidos.',
                    errors: errorMessages,
                } as MessageWithErrorsResponse,
                StatusCodes.BAD_REQUEST,
            );
        }

        return validatedPayload.data;
    };
}

export function validateParamIsNumber(paramName: string) {
    return (value: Record<string, string | undefined>, c: Context): number | Response => {
        const paramValue = value[paramName];

        const num = Number(paramValue);
        if (!paramValue || isNaN(num)) {
            return c.json(
                {
                    success: false,
                    message: 'Parâmetro inválido.',
                } as MessageResponse,
                StatusCodes.BAD_REQUEST,
            );
        }

        return num;
    };
}

export function validateParamIsString(paramName: string) {
    return (value: Record<string, string | undefined>, c: Context): string | Response => {
        const paramValue = value[paramName];
        if (paramValue && paramValue.trim().length === 0)
            return c.json(
                {
                    success: false,
                    message: 'Parâmetro inválido.',
                } as MessageResponse,
                StatusCodes.BAD_REQUEST,
            );
        return String(paramValue);
    };
}

export function validateParamIsEmail(paramName: string) {
    return (value: Record<string, string | undefined>, c: Context): string | Response => {
        const paramValue = value[paramName];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (paramValue && !emailRegex.test(paramValue))
            return c.json(
                {
                    success: false,
                    message: 'Parâmetro inválido.',
                } as MessageResponse,
                StatusCodes.BAD_REQUEST,
            );
        return String(paramValue);
    };
}

export function validateParamIsUuid(paramName: string) {
    return (value: Record<string, string | undefined>, c: Context): string | Response => {
        const paramValue = value[paramName];
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (paramValue && !uuidRegex.test(paramValue))
            return c.json(
                {
                    success: false,
                    message: 'Parâmetro inválido.',
                } as MessageResponse,
                StatusCodes.BAD_REQUEST,
            );
        return String(paramValue);
    };
}
