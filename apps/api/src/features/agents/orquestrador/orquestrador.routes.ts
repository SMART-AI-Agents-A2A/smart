import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { StatusCodes } from 'http-status-codes';
import { Logger } from '../../../core';
import { validateContentType, validateJsonContent } from '../../../core/validators';
import type { MessageResponse } from '../../../shared/types';
import { createOrquestradorChatResponse } from './orquestrador.service';
import { OrquestradorValueObject } from './orquestrador.vo';

export const orquestradorRoutes = new Hono<{ Bindings: CloudflareBindings }>();

orquestradorRoutes.post(
    '/chat',
    validator('header', validateContentType('application/json')),
    validator(
        'json',
        validateJsonContent((data) => OrquestradorValueObject.createSafeChatRequest(data)),
    ),
    async (c) => {
        try {
            const payload = c.req.valid('json');
            const origin = new URL(c.req.url).origin;
            const response = await createOrquestradorChatResponse(payload, {
                origin,
            });

            return c.json(response, StatusCodes.OK);
        } catch (error) {
            Logger.error('Error /v1/ai/chat/ -> post(/chat)', error);
            return c.json<MessageResponse>(
                {
                    success: false,
                    message: 'Falha inesperada.',
                },
                StatusCodes.BAD_GATEWAY,
            );
        }
    },
);
