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

// aiRouter.post(
//     '/query',
//     validator('header', validateContentType('application/json')),
//     validator('json', validateJsonContent(AiValueObject.createSafeInbound)),
//     async (c) => {
//         try {
//             const payload = c.req.valid('json');
//             return await _ai.generateText(payload.query);
//         } catch (error) {
//             Logger.error('Error /v1/ai -> post(/query): ', error);
//             return c.json<MessageResponse>(
//                 { success: false, message: 'Falha inesperada.' },
//                 StatusCodes.INTERNAL_SERVER_ERROR,
//             );
//         }
//     },
// );
