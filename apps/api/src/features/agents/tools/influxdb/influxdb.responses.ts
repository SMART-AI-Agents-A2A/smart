import { v4 as uuidv4 } from 'uuid';
import type {
    ApiErrorResponse,
    ApiSuccessResponse,
    ValidationIssue,
} from '../../../../shared/types';

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
