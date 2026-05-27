import { Agent } from 'agents';
import type { Connection, ConnectionContext } from 'agents';
import { _auth } from '../auth';
import type { AiChatInbound, AgentExecutionResult, RagContext } from './ai.type';
import {
    PRIMARY_MODEL_ID,
    buildFinalMessages,
    buildRagMetadata,
    buildTracePayload,
    executeAgentAdapter,
    getRagContext,
    processUpstreamBlock,
    runPrimaryModelStream,
    runRoutingDecision,
} from './ai.orchestrate';

interface SmartAgentState {
    conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface IncomingChatMessage {
    type: 'chat';
    payload: AiChatInbound;
}

export class SmartAgent extends Agent<CloudflareBindings, SmartAgentState> {
    initialState: SmartAgentState = { conversationMessages: [] };

    async onConnect(connection: Connection, ctx: ConnectionContext) {
        const session = await _auth.api.getSession({ headers: ctx.request.headers });
        if (!session) {
            connection.close(4001, 'Unauthorized');
        }
    }

    async onMessage(connection: Connection, message: string) {
        try {
            const incoming = JSON.parse(message) as IncomingChatMessage;
            if (incoming.type === 'chat') {
                await this.handleChat(connection, incoming.payload);
            }
        } catch {
            this.emit(connection, 'error', { message: 'Formato de mensagem inválido.' });
        }
    }

    private emit(connection: Connection, type: string, data: unknown) {
        connection.send(JSON.stringify({ type, data }));
    }

    private async handleChat(connection: Connection, payload: AiChatInbound) {
        let upstreamReader: ReadableStreamDefaultReader | null = null;

        try {
            this.emit(connection, 'status', {
                phase: 'thinking',
                state: 'active',
                message: 'Consultando contexto RAG da Cloudflare.',
            });
            const ragContext = await getRagContext(this.env, payload);

            this.emit(connection, 'status', {
                phase: 'thinking',
                state: 'active',
                message:
                    ragContext.sources.length > 0
                        ? `RAG retornou ${ragContext.sources.length} fonte(s) para contexto.`
                        : 'RAG nao retornou contexto especifico para esta pergunta.',
            });

            this.emit(connection, 'status', {
                phase: 'thinking',
                state: 'active',
                message: 'Definindo rota e agente necessario.',
            });
            const decision = await runRoutingDecision(this.env, payload, ragContext);
            let agentResult: AgentExecutionResult | null = null;

            this.emit(connection, 'status', {
                phase: 'thinking',
                state: 'active',
                message: decision.reason,
            });

            if (decision.route === 'agent' && decision.selectedAgent) {
                this.emit(connection, 'status', {
                    phase: 'thinking',
                    state: 'complete',
                    message: `Rota definida para o agente ${decision.selectedAgent}.`,
                });
                this.emit(connection, 'status', {
                    phase: 'agent-calling',
                    state: 'active',
                    message: `Chamando agente ${decision.selectedAgent}.`,
                    agentId: decision.selectedAgent,
                    agentName: decision.selectedAgent,
                });
                await new Promise<void>((resolve) => setTimeout(resolve, 0));
                agentResult = await executeAgentAdapter(decision, payload, ragContext, this.env);
                this.emit(connection, 'status', {
                    phase: 'agent-calling',
                    state: 'complete',
                    message: `Agente ${agentResult?.agentName ?? decision.selectedAgent} concluiu.`,
                    agentId: decision.selectedAgent,
                    agentName: agentResult?.agentName ?? decision.selectedAgent,
                });
            } else {
                this.emit(connection, 'status', {
                    phase: 'thinking',
                    state: 'active',
                    message:
                        'Nao acionei agente especializado porque a resposta direta era suficiente.',
                });
                this.emit(connection, 'status', {
                    phase: 'thinking',
                    state: 'complete',
                    message: 'Rota direta definida.',
                });
            }

            const trace = buildTracePayload(decision, agentResult, ragContext);
            this.emit(connection, 'trace', trace);

            const baseRagContext: RagContext = { contextMessage: null, sources: [] };
            const finalMessages = buildFinalMessages(payload, ragContext, decision, agentResult);
            const baseMessages = buildFinalMessages(payload, baseRagContext, decision, agentResult);

            this.emit(connection, 'status', {
                phase: 'thinking',
                state: 'active',
                message: 'Preparando streaming da resposta final.',
            });

            const upstreamSelection = await runPrimaryModelStream(
                this.env,
                finalMessages,
                baseMessages,
                Boolean(ragContext.contextMessage),
            );

            this.emit(connection, 'start', {
                conversationId: payload.conversationId ?? null,
                model: PRIMARY_MODEL_ID,
                gatewayId: upstreamSelection.gatewayId,
                orchestrator: true,
                route: decision.route,
                selectedAgent: decision.selectedAgent,
                rag: buildRagMetadata(ragContext, upstreamSelection.usedRagContext),
            });

            this.emit(connection, 'status', {
                phase: 'responding',
                state: 'active',
                message: 'Gerando resposta final.',
            });

            upstreamReader = upstreamSelection.stream.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            let buffer = '';
            let finished = false;

            while (!finished) {
                const { done, value } = await upstreamReader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                while (true) {
                    const boundary = buffer.indexOf('\n\n');
                    if (boundary === -1) break;
                    const block = buffer.slice(0, boundary);
                    buffer = buffer.slice(boundary + 2);

                    const isDone = processUpstreamBlock(block, (delta) => {
                        fullResponse += delta;
                        this.emit(connection, 'delta', { delta });
                    });
                    if (isDone) {
                        finished = true;
                        break;
                    }
                }
            }

            buffer += decoder.decode();
            if (!finished && buffer.trim()) {
                processUpstreamBlock(buffer, (delta) => {
                    fullResponse += delta;
                    this.emit(connection, 'delta', { delta });
                });
            }

            this.emit(connection, 'status', {
                phase: 'responding',
                state: 'complete',
                message: 'Resposta final concluida.',
            });

            this.emit(connection, 'done', {
                response: fullResponse,
                model: PRIMARY_MODEL_ID,
                gatewayId: upstreamSelection.gatewayId,
                orchestrator: true,
                route: decision.route,
                selectedAgent: decision.selectedAgent,
                agentResult,
                trace,
                rag: buildRagMetadata(ragContext, upstreamSelection.usedRagContext),
            });

            const lastUserMessage =
                [...payload.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
            this.setState({
                conversationMessages: [
                    ...this.state.conversationMessages.slice(-20),
                    { role: 'user', content: lastUserMessage },
                    { role: 'assistant', content: fullResponse },
                ],
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao gerar resposta.';
            this.emit(connection, 'error', { message });
        } finally {
            upstreamReader?.releaseLock();
        }
    }
}
