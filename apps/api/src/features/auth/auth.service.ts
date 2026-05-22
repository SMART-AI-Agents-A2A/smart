import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { env } from 'cloudflare:workers';
import { AUTH_CONFIG } from './auth.config';
import { _db } from '../../core/db';
import * as schema from '../../core/db/schema';

export const _auth = betterAuth({
    secret: env.AUTH_SECRET,
    basePath: '/v1/auth',
    database: drizzleAdapter(_db, {
        provider: 'sqlite',
        usePlural: true,
        schema,
    }),
    advanced: {
        cookiePrefix: 'smart',
    },
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            redirectURI: `${env.AUTH_BASE_URL}/v1/auth/google/callback`,
        },
    },
    trustedOrigins: [
        env.FRONTEND_BASE_URL,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],
    baseURL: env.AUTH_BASE_URL,
    session: {
        expiresIn: AUTH_CONFIG.REFRESH_TOKEN_EXPIRY,
        updateAge: AUTH_CONFIG.SESSION_UPDATE_AGE,
        fields: {
            userId: 'user_id',
            expiresAt: 'expires_at',
            ipAddress: 'ip_address',
            userAgent: 'user_agent',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    },
    account: {
        fields: {
            userId: 'user_id',
            accountId: 'account_id',
            providerId: 'provider_id',
            accessToken: 'access_token',
            refreshToken: 'refresh_token',
            idToken: 'id_token',
            accessTokenExpiresAt: 'access_token_expires_at',
            refreshTokenExpiresAt: 'refresh_token_expires_at',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    },
    verification: {
        fields: {
            expiresAt: 'expires_at',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    },
    user: {
        fields: {
            emailVerified: 'email_verified',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        additionalFields: {
            role: {
                type: 'string' as const,
                required: false,
                defaultValue: 'viewer',
                input: false,
            },
            first_login: {
                type: 'boolean' as const,
                required: false,
                defaultValue: true,
                input: false,
            },
        },
    },
});
