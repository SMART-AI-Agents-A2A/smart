export interface BaseResponse {
    success: boolean;
}

export interface MessageResponse extends BaseResponse {
    message: string;
}

export interface MessageWithErrorsResponse extends MessageResponse {
    errors: { path: string; message: string }[];
}

export interface DataResponse<T> extends BaseResponse {
    data: T;
}
