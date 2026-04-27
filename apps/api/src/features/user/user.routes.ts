import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import type { DataResponse } from '../../shared/types';
import { authMiddleware } from '../auth/';
import { UserDatabase } from './user.database';
import type { UserOutbound } from './user.vo';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.get('/', authMiddleware, async (c) => {
    const users = await UserDatabase.list();
    return c.json<DataResponse<Array<UserOutbound>>>(
        { success: true, data: users },
        StatusCodes.OK,
    );
});

export { router as userRouter };
