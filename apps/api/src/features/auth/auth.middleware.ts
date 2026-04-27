import { createMiddleware } from 'hono/factory';
import { StatusCodes } from 'http-status-codes';
import type { MessageResponse } from '../../shared/types/responses';
import { type UserAuthOutbound, UserAuthValueObject } from './auth.vo';
import { _auth } from './';

export const authMiddleware = createMiddleware<{
    Bindings: CloudflareBindings;
    Variables: { user: UserAuthOutbound };
}>(async (c, next) => {
    const session = await _auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
        return c.json<MessageResponse>(
            {
                success: false,
                message: 'Autenticação necessária. Faça login para continuar.',
            },
            StatusCodes.UNAUTHORIZED,
        );
    }

    const user = UserAuthValueObject.createAuthOutbound(session.user);
    c.set('user', user);
    await next();
});
