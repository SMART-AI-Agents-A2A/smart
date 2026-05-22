import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import type { DataResponse } from '../../shared/types';
import { authMiddleware } from '../auth/';
import { UserService } from './user.service';
import type { UserOutbound } from './user.type';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.get('/', authMiddleware, async (c) => {
    const users = await UserService.list();
    return c.json<DataResponse<Array<UserOutbound>>>(
        { success: true, data: users },
        StatusCodes.OK,
    );
});

export { router as userRouter };
