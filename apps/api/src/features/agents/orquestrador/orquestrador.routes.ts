import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { createOrquestradorChatResponse } from './orquestrador.service';
import { orquestradorChatRequestSchema } from './orquestrador.schemas';

const router = new Hono<{ Bindings: CloudflareBindings }>();

const validationIssues = (error: z.ZodError) => {
    return error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || 'root',
        message: issue.message,
    }));
};

router.post('/chat', async (c) => {
    let payload: unknown;

    try {
        payload = await c.req.json();
    } catch {
        return c.json(
            {
                success: false,
                error: {
                    message: 'JSON inválido.',
                },
            },
            StatusCodes.BAD_REQUEST,
        );
    }

    const parsed = orquestradorChatRequestSchema.safeParse(payload);

    if (!parsed.success) {
        return c.json(
            {
                success: false,
                error: {
                    message: 'Payload inválido para o chat do orquestrador.',
                    issues: validationIssues(parsed.error),
                },
            },
            StatusCodes.BAD_REQUEST,
        );
    }

    try {
        const origin = new URL(c.req.url).origin;
        const response = await createOrquestradorChatResponse(parsed.data, {
            origin,
        });

        return c.json(response, StatusCodes.OK);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Falha desconhecida na delegação A2A.';

        return c.json(
            {
                success: false,
                error: {
                    message,
                },
            },
            StatusCodes.BAD_GATEWAY,
        );
    }
});

export { router as orquestradorRoutes };
