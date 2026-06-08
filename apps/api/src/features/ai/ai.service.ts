import type { AgentExecutionResult, AiChatInbound, AiStatusEvent, SseEventName } from './ai.type';
import {
    buildFinalMessages,
    buildRagMetadata,
    buildTracePayload,
    executeAgentPlan,
    getRagContext,
    processUpstreamBlock,
    runPrimaryModelStream,
    runRoutingDecision,
    toSseEvent,
    toStatusEvent,
} from './ai.orchestrate';
import { resolveModelId } from './ai.models';

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
                        let agentResults: Array<AgentExecutionResult> = [];

                        emitStatus({
                            phase: 'thinking',
                            state: 'active',
                            message: decision.reason,
                        });

                        if (decision.route !== 'direct' && decision.calls.length > 0) {
                            emitStatus({
                                phase: 'thinking',
                                state: 'complete',
                                message:
                                    decision.route === 'multi-agent'
                                        ? `Plano definido com ${decision.calls.length} chamada(s) de agente.`
                                        : `Rota definida para o agente ${decision.selectedAgent}.`,
                            });
                            emitStatus({
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
                                payload,
                                ragContext,
                                env,
                            );
                            const primaryAgentResult = agentResults[0] ?? null;

                            emitStatus({
                                phase: 'agent-calling',
                                state: 'complete',
                                message:
                                    agentResults.length > 1
                                        ? `${agentResults.length} chamada(s) de agente concluidas.`
                                        : `Agente ${primaryAgentResult?.agentName ?? decision.selectedAgent} concluiu a chamada.`,
                                agentId: decision.selectedAgent,
                                agentName: primaryAgentResult?.agentName ?? decision.selectedAgent,
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

                        const agentResult = agentResults[0] ?? null;
                        const trace = buildTracePayload(decision, agentResults, ragContext);
                        emit('trace', trace);

                        const baseRagContext = { contextMessage: null, sources: [] };
                        const finalMessages = buildFinalMessages(
                            payload,
                            ragContext,
                            decision,
                            agentResults,
                        );
                        const baseMessages = buildFinalMessages(
                            payload,
                            baseRagContext,
                            decision,
                            agentResults,
                        );

                        emitStatus({
                            phase: 'thinking',
                            state: 'active',
                            message: 'Preparando streaming da resposta final.',
                        });
                        const modelId = resolveModelId(payload.model);
                        const upstreamSelection = await runPrimaryModelStream(
                            env,
                            finalMessages,
                            baseMessages,
                            Boolean(ragContext.contextMessage),
                            modelId,
                        );
                        upstreamReader = upstreamSelection.stream.getReader();
                        const decoder = new TextDecoder();

                        emit('start', {
                            conversationId: payload.conversationId ?? null,
                            model: upstreamSelection.model,
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
