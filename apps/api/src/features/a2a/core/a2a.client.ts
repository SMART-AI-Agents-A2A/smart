import { v4 as uuidv4 } from 'uuid';
import { A2AError, a2aErrorCodes } from './a2a.errors';
import type { AgentCard, Message, MessageSendParams, MessageSendResponse } from './a2a.type';
import { A2AValueObject } from './a2a.vo';

export interface A2AClientOptions {
    readonly baseUrl: string;
    readonly fetcher?: typeof fetch;
}

export class A2AClient {
    private readonly baseUrl: string;
    private readonly fetcher: typeof fetch;

    constructor({ baseUrl, fetcher }: A2AClientOptions) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.fetcher = (input, init) => (fetcher ?? fetch)(input, init);
    }

    async getAgentCard(): Promise<AgentCard> {
        const response = await this.fetcher(`${this.baseUrl}/.well-known/agent-card.json`);

        if (!response.ok) {
            throw new A2AError(
                a2aErrorCodes.internalError,
                `Falha ao buscar Agent Card: HTTP ${response.status}.`,
            );
        }

        return A2AValueObject.createAgentCard(await response.json());
    }

    async sendMessage(params: MessageSendParams): Promise<MessageSendResponse> {
        const response = await this.fetcher(this.baseUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: uuidv4(),
                method: 'message/send',
                params,
            }),
        });

        const payload = await response.json();
        const parsed = A2AValueObject.createSafeMessageSendResponse(payload);

        if (!parsed.success) {
            throw new A2AError(
                a2aErrorCodes.invalidRequest,
                'Resposta JSON-RPC inválida do agente A2A.',
                {
                    issues: parsed.error.issues,
                },
            );
        }

        return parsed.data;
    }

    async sendText(
        text: string,
        metadata: Record<string, unknown> = {},
    ): Promise<MessageSendResponse> {
        const message: Message = {
            messageId: uuidv4(),
            role: 'user',
            parts: [
                {
                    kind: 'text',
                    text,
                },
            ],
            metadata,
        };

        return this.sendMessage({
            message,
            metadata,
        });
    }
}
