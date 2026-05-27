import type { AiChatInbound, AiStatusEvent, SseEventName } from './ai.type';
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
    toSseEvent,
    toStatusEvent,
} from './ai.orchestrate';

export class AiService {
    static async streamPrimaryChat(
        env: CloudflareBindings,
        payload: AiChatInbound,
    ): Promise<ReadableStream<Uint8Array>> {
        const encoder = new TextEncoder();
        let upstreamReader: ReadableStreamDefaultReader | null = null;

        return new ReadableStream<Uint8Array>({
            start(controller) {
                const emit = (event: SseEventName, payload: unknown) => {
                    controller.enqueue(encoder.encode(toSseEvent(event, payload)));
                };
                const emitStatus = (status: AiStatusEvent) => {
                    controller.enqueue(encoder.encode(toStatusEvent(status)));
                };

                const runStream = async () => {
                    let fullResponse = '';
                    let buffer = '';
                    let finished = false;

                    try {
                        emitStatus({
                            phase: 'thinking',
                            state: 'active',
                            message: 'Consultando contexto RAG da Cloudflare.',
                        });
                        const ragContext = await getRagContext(env, payload);

                        emitStatus({
                            phase: 'thinking',
                            state: 'active',
                            message:
                                ragContext.sources.length > 0
                                    ? `RAG retornou ${ragContext.sources.length} fonte(s) para contexto.`
                                    : 'RAG nao retornou contexto especifico para esta pergunta.',
                        });
                        emitStatus({
                            phase: 'thinking',
                            state: 'active',
                            message: 'Definindo rota e agente necessario.',
                        });
                        const decision = await runRoutingDecision(env, payload, ragContext);
                        let agentResult = null;

                        emitStatus({
                            phase: 'thinking',
                            state: 'active',
                            message: decision.reason,
                        });

                        if (decision.route === 'agent' && decision.selectedAgent) {
                            emitStatus({
                                phase: 'thinking',
                                state: 'complete',
                                message: `Rota definida para o agente ${decision.selectedAgent}.`,
                            });
                            emitStatus({
                                phase: 'agent-calling',
                                state: 'active',
                                message: `Chamando agente ${decision.selectedAgent}.`,
                                agentId: decision.selectedAgent,
                                agentName: decision.selectedAgent,
                            });
                            await new Promise<void>((resolve) => setTimeout(resolve, 0));
                            agentResult = await executeAgentAdapter(
                                decision,
                                payload,
                                ragContext,
                                env,
                            );

                            emitStatus({
                                phase: 'agent-calling',
                                state: 'complete',
                                message: `Agente ${agentResult?.agentName ?? decision.selectedAgent} concluiu a chamada.`,
                                agentId: decision.selectedAgent,
                                agentName: agentResult?.agentName ?? decision.selectedAgent,
                            });
                        } else {
                            emitStatus({
                                phase: 'thinking',
                                state: 'active',
                                message:
                                    'Nao acionei agente especializado porque a resposta direta era suficiente.',
                            });
                            emitStatus({
                                phase: 'thinking',
                                state: 'complete',
                                message: 'Rota direta definida.',
                            });
                        }

                        const trace = buildTracePayload(decision, agentResult, ragContext);
                        emit('trace', trace);

                        const baseRagContext = { contextMessage: null, sources: [] };
                        const finalMessages = buildFinalMessages(
                            payload,
                            ragContext,
                            decision,
                            agentResult,
                        );
                        const baseMessages = buildFinalMessages(
                            payload,
                            baseRagContext,
                            decision,
                            agentResult,
                        );

                        emitStatus({
                            phase: 'thinking',
                            state: 'active',
                            message: 'Preparando streaming da resposta final.',
                        });
                        const upstreamSelection = await runPrimaryModelStream(
                            env,
                            finalMessages,
                            baseMessages,
                            Boolean(ragContext.contextMessage),
                        );
                        upstreamReader = upstreamSelection.stream.getReader();
                        const decoder = new TextDecoder();

                        emit('start', {
                            conversationId: payload.conversationId ?? null,
                            model: PRIMARY_MODEL_ID,
                            gatewayId: upstreamSelection.gatewayId,
                            orchestrator: true,
                            route: decision.route,
                            selectedAgent: decision.selectedAgent,
                            rag: buildRagMetadata(ragContext, upstreamSelection.usedRagContext),
                        });
                        emitStatus({
                            phase: 'thinking',
                            state: 'complete',
                            message: 'Contexto e rota prontos para responder.',
                        });
                        emitStatus({
                            phase: 'responding',
                            state: 'active',
                            message: 'Gerando resposta final.',
                        });

                        while (!finished) {
                            const { done, value } = await upstreamReader.read();
                            if (done) {
                                break;
                            }

                            buffer += decoder.decode(value, { stream: true });

                            while (true) {
                                const boundary = buffer.indexOf('\n\n');
                                if (boundary === -1) {
                                    break;
                                }

                                const block = buffer.slice(0, boundary);
                                buffer = buffer.slice(boundary + 2);

                                const isDone = processUpstreamBlock(block, (delta) => {
                                    fullResponse += delta;
                                    emit('delta', {
                                        delta,
                                    });
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
                                emit('delta', {
                                    delta,
                                });
                            });
                        }

                        emitStatus({
                            phase: 'responding',
                            state: 'complete',
                            message: 'Resposta final concluida.',
                        });
                        emit('done', {
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
                        controller.close();
                    } catch (error) {
                        const message =
                            error instanceof Error
                                ? error.message
                                : 'Falha ao gerar resposta da IA.';
                        emit('error', {
                            message,
                        });
                        controller.close();
                    } finally {
                        upstreamReader?.releaseLock();
                    }
                };

                void runStream();
            },
            async cancel() {
                await upstreamReader?.cancel();
            },
        });
    }
}
