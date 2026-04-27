import type { MiddlewareHandler } from 'hono';
import { StatusCodes } from 'http-status-codes';
import type { DataResponse } from '../../shared/types';

export function statsMiddleware(): MiddlewareHandler {
    return async (c) => {
        return c.json<DataResponse<any>>(
            {
                success: true,
                data: {
                    name: 'Smart API',
                    version: 'v1',
                    status: 'operational',
                },
            },
            StatusCodes.OK,
        );
    };
}
