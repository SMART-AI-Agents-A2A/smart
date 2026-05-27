import { createAuthClient } from 'better-auth/react';
import { apiOrigin } from '../../../shared/api';

export const authClient = createAuthClient({
    baseURL: apiOrigin,
    basePath: '/v1/auth',
});
