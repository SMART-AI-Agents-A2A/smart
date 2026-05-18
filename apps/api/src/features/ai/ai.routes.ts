import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import type { MessageResponse, MessageWithErrorsResponse } from '../../shared/types';
import { authMiddleware } from '../auth';
import { AiService } from './ai.service';
import { AiValueObject } from './ai.vo';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.post('/chat', authMiddleware, async (c) => {
    const contentType = c.req.header('content-type');
    if (!contentType?.includes('application/json')) {
        return c.json<MessageResponse>(
            {
                success: false,
                message: 'Content-type inválido.',
            },
            StatusCodes.UNSUPPORTED_MEDIA_TYPE,
        );
    }

    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json<MessageResponse>(
            {
                success: false,
                message: 'Dados inválidos.',
            },
            StatusCodes.BAD_REQUEST,
        );
    }

    const validatedPayload = AiValueObject.createSafeChatInbound(body);
    if (!validatedPayload.success) {
        const errors = validatedPayload.error.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
        }));

        return c.json<MessageWithErrorsResponse>(
            {
                success: false,
                message: 'Dados inválidos.',
                errors,
            },
            StatusCodes.BAD_REQUEST,
        );
    }

    try {
        const stream = await AiService.streamPrimaryChat(c.env, validatedPayload.data);
        return new Response(stream, {
            headers: {
                'content-type': 'text/event-stream; charset=utf-8',
                'cache-control': 'no-cache, no-transform',
                connection: 'keep-alive',
            },
            status: StatusCodes.OK,
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Falha inesperada ao iniciar streaming.';
        return c.json<MessageResponse>(
            {
                success: false,
                message,
            },
            StatusCodes.INTERNAL_SERVER_ERROR,
        );
    }
});

export { router as aiRouter };
