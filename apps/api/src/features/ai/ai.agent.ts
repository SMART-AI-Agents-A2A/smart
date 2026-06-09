import { Agent } from 'agents';
import type { Connection, ConnectionContext } from 'agents';
import { _auth } from '../auth';
import type {
    AgentId,
    AiChatInbound,
    AgentExecutionResult,
    AiStatusPhase,
    AiStatusState,
    RagContext,
    SmartAgentIncomingMessage,
    SmartAgentState,
    StoredAssistantTrace,
    StoredChatMessage,
} from './ai.type';
import {
    buildFinalMessages,
    buildRagMetadata,
    buildTracePayload,
    executeAgentPlan,
    getRagContext,
    processUpstreamBlock,
    runPrimaryModelStream,
    runRoutingDecision,
} from './ai.orchestrate';
import { resolveModelId } from './ai.models';
import { mergeStoredAssistantTraces } from './ai.history';

const MAX_STORED_MESSAGES = 20;

export class SmartAgent extends Agent<CloudflareBindings, SmartAgentState> {
    static options = { sendIdentityOnConnect: false };

    initialState: SmartAgentState = { accountId: null, conversationMessages: [] };

    shouldSendProtocolMessages() {
        return false;
    }

    async onConnect(connection: Connection, ctx: ConnectionContext) {
        const session = await _auth.api.getSession({ headers: ctx.request.headers });
        if (!session) {
            connection.close(4001, 'Unauthorized');
            return;
        }

        if (this.name !== session.user.id) {
            connection.close(4003, 'Forbidden');
            return;
        }

        if (this.state.accountId && this.state.accountId !== session.user.id) {
            connection.close(4003, 'Forbidden');
            return;
        }

        if (!this.state.accountId) {
            this.setState({ ...this.state, accountId: session.user.id });
        }

        this.emitHistory(connection);
    }

    async onMessage(connection: Connection, message: string) {
        try {
            const incoming = JSON.parse(message) as SmartAgentIncomingMessage;
            if (incoming.type === 'chat') {
                await this.handleChat(connection, incoming.payload);
                return;
            }

            if (incoming.type === 'clear') {
                this.clearConversation();
                this.emit(connection, 'cleared', {});
            }
        } catch {
            this.emit(connection, 'error', { message: 'Formato de mensagem invalido.' });
        }
    }

    private emit(connection: Connection, type: string, data: unknown) {
        connection.send(JSON.stringify({ type, data }));
    }

    private emitStatus(
        connection: Connection,
        thinkingLog: Array<string>,
        payload: {
            phase: AiStatusPhase;
            state: AiStatusState;
            message: string;
            agentId?: AgentId | null;
            agentName?: string | null;
        },
    ) {
        if (payload.phase === 'thinking') {
            const normalized = payload.message.trim();
            if (normalized && !thinkingLog.includes(normalized)) {
                thinkingLog.push(normalized);
            }
        }

        this.emit(connection, 'status', payload);
    }

    private emitHistory(connection: Connection) {
        this.emit(connection, 'history', {
            messages: this.state.conversationMessages,
        });
    }

    private clearConversation() {
        this.setState({ ...this.state, conversationMessages: [] });
    }

    private buildContextPayload(payload: AiChatInbound): AiChatInbound {
        const storedMessages = this.state.conversationMessages;
        const lastUserMessage = [...payload.messages]
            .reverse()
            .find((message) => message.role === 'user' && message.content.trim().length > 0);

        if (!lastUserMessage) {
            return payload;
        }

        if (payload.messages.length > storedMessages.length) {
            return {
                ...payload,
                messages: payload.messages.slice(-MAX_STORED_MESSAGES),
            };
        }

        const storedLastMessage = storedMessages.at(-1);
        const shouldAppendLastUser =
            storedLastMessage?.role !== lastUserMessage.role ||
            storedLastMessage.content !== lastUserMessage.content;

        return {
            ...payload,
            messages: [...storedMessages, ...(shouldAppendLastUser ? [lastUserMessage] : [])].slice(
                -MAX_STORED_MESSAGES,
            ),
        };
    }

    private saveConversation(messages: Array<StoredChatMessage>) {
        const merged = mergeStoredAssistantTraces(this.state.conversationMessages, messages);
        this.setState({
            ...this.state,
            conversationMessages: merged.slice(-MAX_STORED_MESSAGES),
        });
    }

    private async handleChat(connection: Connection, payload: AiChatInbound) {
        let upstreamReader: ReadableStreamDefaultReader | null = null;
        const thinkingLog: Array<string> = [];

        try {
            const contextPayload = this.buildContextPayload(payload);

            this.emitStatus(connection, thinkingLog, {
                phase: 'thinking',
                state: 'active',
                message: 'Consultando contexto RAG da Cloudflare.',
            });
            const ragContext = await getRagContext(this.env, contextPayload);

            this.emitStatus(connection, thinkingLog, {
                phase: 'thinking',
                state: 'active',
                message:
                    ragContext.sources.length > 0
                        ? `RAG retornou ${ragContext.sources.length} fonte(s) para contexto.`
                        : 'RAG nao retornou contexto especifico para esta pergunta.',
            });

            this.emitStatus(connection, thinkingLog, {
                phase: 'thinking',
                state: 'active',
                message: 'Definindo rota e agente necessario.',
            });
            const decision = await runRoutingDecision(this.env, contextPayload, ragContext);
            let agentResults: Array<AgentExecutionResult> = [];

            this.emitStatus(connection, thinkingLog, {
                phase: 'thinking',
                state: 'active',
                message: decision.reason,
            });

            if (decision.route !== 'direct' && decision.calls.length > 0) {
                this.emitStatus(connection, thinkingLog, {
                    phase: 'thinking',
                    state: 'complete',
                    message:
                        decision.route === 'multi-agent'
                            ? `Plano definido com ${decision.calls.length} chamada(s) de agente.`
                            : `Rota definida para o agente ${decision.selectedAgent}.`,
                });
                this.emitStatus(connection, thinkingLog, {
                    phase: 'agent-calling',
                    state: 'active',
                    message:
                        decision.route === 'multi-agent'
                            ? `Chamando ${decision.calls.length} agente(s).`
                            : `Chamando agente ${decision.selectedAgent}.`,
                    agentId: decision.selectedAgent,
                    agentName: decision.selectedAgent,
                });
                await new Promise<void>((resolve) => setTimeout(resolve, 0));
                agentResults = await executeAgentPlan(
                    decision,
                    contextPayload,
                    ragContext,
                    this.env,
                );
                const primaryAgentResult = agentResults[0] ?? null;
                this.emitStatus(connection, thinkingLog, {
                    phase: 'agent-calling',
                    state: 'complete',
                    message:
                        agentResults.length > 1
                            ? `${agentResults.length} chamada(s) de agente concluidas.`
                            : `Agente ${primaryAgentResult?.agentName ?? decision.selectedAgent} concluiu.`,
                    agentId: decision.selectedAgent,
                    agentName: primaryAgentResult?.agentName ?? decision.selectedAgent,
                });
            } else {
                this.emitStatus(connection, thinkingLog, {
                    phase: 'thinking',
                    state: 'active',
                    message:
                        'Nao acionei agente especializado porque a resposta direta era suficiente.',
                });
                this.emitStatus(connection, thinkingLog, {
                    phase: 'thinking',
                    state: 'complete',
                    message: 'Rota direta definida.',
                });
            }

            const agentResult = agentResults[0] ?? null;
            const trace = buildTracePayload(decision, agentResults, ragContext);
            this.emit(connection, 'trace', trace);

            const baseRagContext: RagContext = { contextMessage: null, sources: [] };
            const finalMessages = buildFinalMessages(
                contextPayload,
                ragContext,
                decision,
                agentResults,
            );
            const baseMessages = buildFinalMessages(
                contextPayload,
                baseRagContext,
                decision,
                agentResults,
            );

            this.emitStatus(connection, thinkingLog, {
                phase: 'thinking',
                state: 'active',
                message: 'Preparando streaming da resposta final.',
            });

            const modelId = resolveModelId(payload.model);
            const upstreamSelection = await runPrimaryModelStream(
                this.env,
                finalMessages,
                baseMessages,
                Boolean(ragContext.contextMessage),
                modelId,
            );

            this.emit(connection, 'start', {
                conversationId: contextPayload.conversationId ?? null,
                model: upstreamSelection.model,
                gatewayId: upstreamSelection.gatewayId,
                orchestrator: true,
                route: decision.route,
                selectedAgent: decision.selectedAgent,
                rag: buildRagMetadata(ragContext, upstreamSelection.usedRagContext),
            });

            this.emitStatus(connection, thinkingLog, {
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

            this.emitStatus(connection, thinkingLog, {
                phase: 'responding',
                state: 'complete',
                message: 'Resposta final concluida.',
            });

            this.emit(connection, 'done', {
                response: fullResponse,
                model: upstreamSelection.model,
                gatewayId: upstreamSelection.gatewayId,
                orchestrator: true,
                route: decision.route,
                selectedAgent: decision.selectedAgent,
                agentResult,
                agentResults,
                trace,
                rag: buildRagMetadata(ragContext, upstreamSelection.usedRagContext),
            });

            const storedTrace: StoredAssistantTrace = {
                thinking: thinkingLog,
                trace,
            };
            this.saveConversation([
                ...contextPayload.messages,
                { role: 'assistant', content: fullResponse, trace: storedTrace },
            ]);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao gerar resposta.';
            this.emit(connection, 'error', { message });
        } finally {
            upstreamReader?.releaseLock();
        }
    }
}
