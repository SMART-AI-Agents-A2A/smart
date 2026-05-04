import { createAuthClient } from 'better-auth/react';

const apiOrigin = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

export const authClient = createAuthClient({
    baseURL: apiOrigin,
    basePath: '/v1/auth',
});
