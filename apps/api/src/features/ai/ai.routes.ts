import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import type { MessageResponse } from '../../shared/types';
import { authMiddleware } from '../auth';
import { AiService } from './ai.service';
import { AiValueObject } from './ai.vo';
import { validateContentType, validateJsonContent } from '../../core/validators';
import { validator } from 'hono/validator';
import { Logger } from '../../core';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.post(
    '/chat',
    validator('header', validateContentType('application/json')),
    validator('json', validateJsonContent(AiValueObject.createSafeChatInbound)),
    authMiddleware,
    async (c) => {
        try {
            const payload = c.req.valid('json');

            const stream = await AiService.streamPrimaryChat(c.env, payload);

            return new Response(stream, {
                headers: {
                    'content-type': 'text/event-stream; charset=utf-8',
                    'cache-control': 'no-cache, no-transform',
                    connection: 'keep-alive',
                },
                status: StatusCodes.OK,
            });
        } catch (error) {
            Logger.error('Error /v1/ai -> post(/chat): ', error);
            return c.json<MessageResponse>(
                {
                    success: false,
                    message: 'Falha inesperada.',
                },
                StatusCodes.INTERNAL_SERVER_ERROR,
            );
        }
    },
);

export { router as aiRouter };
