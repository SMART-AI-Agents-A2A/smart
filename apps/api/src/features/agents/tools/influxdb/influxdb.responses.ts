import { v4 as uuidv4 } from 'uuid';
import type { ZodError } from 'zod';
import type { ApiErrorResponse, ApiSuccessResponse, ValidationIssue } from './influxdb.types';

export const success = <TData>(data: TData): ApiSuccessResponse<TData> => {
    return {
        requestId: uuidv4(),
        success: true,
        data,
    };
};

export const fail = (message: string, issues?: readonly ValidationIssue[]): ApiErrorResponse => {
    return {
        requestId: uuidv4(),
        success: false,
        error: {
            message,
            issues,
        },
    };
};

export const zodIssuesToValidationIssues = (error: ZodError): readonly ValidationIssue[] => {
    return error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || 'root',
        message: issue.message,
    }));
};
