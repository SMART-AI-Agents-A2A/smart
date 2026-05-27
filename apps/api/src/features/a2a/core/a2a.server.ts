import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { v4 as uuidv4 } from 'uuid';
import { zodIssuesToValidationIssues } from '../../../core/validators';
import { A2AError, a2aErrorCodes, toA2AError } from './a2a.errors';
import type { AgentCard, JsonRpcRequest, Message, MessageSendParams, Task } from './a2a.type';
import { A2AValueObject } from './a2a.vo';

type A2AHandlerResult = Message | Task;

export interface A2AMessageSendContext {
    readonly env: CloudflareBindings;
}

export type A2AMessageSendHandler = (
    params: MessageSendParams,
    context: A2AMessageSendContext,
) => A2AHandlerResult | Promise<A2AHandlerResult>;

export interface CreateA2AServerOptions {
    readonly card: AgentCard;
    readonly onMessageSend: A2AMessageSendHandler;
}

const jsonRpcResponse = (id: JsonRpcRequest['id'], result: A2AHandlerResult) => ({
    jsonrpc: '2.0' as const,
    id,
    result,
});

const jsonRpcErrorResponse = (id: JsonRpcRequest['id'], error: A2AError) => ({
    jsonrpc: '2.0' as const,
    id,
    error: error.toJsonRpcError(),
});

export const createAgentMessage = (
    text: string,
    metadata: Record<string, unknown> = {},
): Message => ({
    messageId: uuidv4(),
    role: 'agent',
    parts: [
        {
            kind: 'text',
            text,
        },
    ],
    metadata,
});

export const createCompletedTask = (
    message: Message,
    metadata: Record<string, unknown> = {},
    history: readonly Message[] = [],
): Task => ({
    id: uuidv4(),
    status: {
        state: 'completed',
        message,
        timestamp: new Date().toISOString(),
    },
    history: [...history],
    metadata,
});

export const createInputRequiredTask = (
    message: Message,
    metadata: Record<string, unknown> = {},
    history: readonly Message[] = [],
): Task => ({
    id: uuidv4(),
    status: {
        state: 'input-required',
        message,
        timestamp: new Date().toISOString(),
    },
    history: [...history],
    metadata,
});

export const createA2AServer = ({ card, onMessageSend }: CreateA2AServerOptions) => {
    const router = new Hono<{ Bindings: CloudflareBindings }>();
    const parsedCard = A2AValueObject.createAgentCard(card);

    router.get('/.well-known/agent-card.json', (c) => c.json(parsedCard, StatusCodes.OK));

    router.post('/', async (c) => {
        let payload: unknown;

        try {
            payload = await c.req.json();
        } catch {
            return c.json(
                jsonRpcErrorResponse(
                    null,
                    new A2AError(a2aErrorCodes.parseError, 'JSON inválido.'),
                ),
                StatusCodes.BAD_REQUEST,
            );
        }

        const requestResult = A2AValueObject.createSafeJsonRpcRequest(payload);

        if (!requestResult.success) {
            return c.json(
                jsonRpcErrorResponse(
                    null,
                    new A2AError(
                        a2aErrorCodes.invalidRequest,
                        'Requisição JSON-RPC inválida.',
                        zodIssuesToValidationIssues(requestResult.error),
                    ),
                ),
                StatusCodes.BAD_REQUEST,
            );
        }

        const request = requestResult.data;

        if (request.method !== 'message/send') {
            return c.json(
                jsonRpcErrorResponse(
                    request.id,
                    new A2AError(
                        a2aErrorCodes.methodNotFound,
                        `Método A2A não suportado: ${request.method}.`,
                    ),
                ),
                StatusCodes.OK,
            );
        }

        const paramsResult = A2AValueObject.createSafeMessageSendParams(request.params);

        if (!paramsResult.success) {
            return c.json(
                jsonRpcErrorResponse(
                    request.id,
                    new A2AError(
                        a2aErrorCodes.invalidParams,
                        'Parâmetros inválidos para message/send.',
                        zodIssuesToValidationIssues(paramsResult.error),
                    ),
                ),
                StatusCodes.OK,
            );
        }

        try {
            const result = await onMessageSend(paramsResult.data, { env: c.env });

            return c.json(jsonRpcResponse(request.id, result), StatusCodes.OK);
        } catch (error) {
            return c.json(jsonRpcErrorResponse(request.id, toA2AError(error)), StatusCodes.OK);
        }
    });

    return router;
};
