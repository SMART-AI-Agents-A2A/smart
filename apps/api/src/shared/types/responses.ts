export interface BaseResponse {
    success: boolean;
}

export interface ValidationIssue {
    readonly path: string;
    readonly message: string;
}

export interface MessageResponse extends BaseResponse {
    message: string;
}

export interface MessageWithErrorsResponse extends MessageResponse {
    errors: { path: string; message: string }[];
}

export interface MessageWithIssuesResponse extends MessageResponse {
    readonly success: false;
    readonly issues?: readonly ValidationIssue[];
}

export interface DataResponse<T> extends BaseResponse {
    data: T;
}

export interface ApiSuccessResponse<TData> {
    readonly requestId: string;
    readonly success: true;
    readonly data: TData;
}

export interface ApiErrorResponse {
    readonly requestId: string;
    readonly success: false;
    readonly error: {
        readonly message: string;
        readonly issues?: readonly ValidationIssue[];
    };
}
