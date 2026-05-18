import { type SyntheticEvent, useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@base-ui/react/button';
import { Field } from '@base-ui/react/field';
import { Input } from '@base-ui/react/input';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, LogOut, MessageSquare, Radio, ShieldCheck } from 'lucide-react';
import { authClient } from '../user/api/auth-client';
import {
    type OrchestratorTrace,
    type OrchestratorRoute,
    type PrimaryAiDoneEvent,
    type PrimaryAiMessage,
    streamPrimaryAiChat,
} from './api/ai-client';

type Message =
    | {
          id: number;
          role: 'assistant' | 'user';
          text: string;
          agentName?: string | null;
      }
    | {
          id: number;
          role: 'trace';
          trace: OrchestratorTrace | null;
      };

type ChatMutationInput = {
    conversationId: string;
    messages: Array<PrimaryAiMessage>;
    traceMessageId: number;
    assistantMessageId: number;
};

type OrchestratorStatus = {
    route: OrchestratorRoute | null;
    selectedAgent: string | null;
    sourceCount: number;
    ragEnabled: boolean;
};

const initialMessages: Array<Message> = [
    {
        id: 1,
        role: 'assistant',
        text: 'Sou o Orquestrador Smart. Pergunte sobre solo, chuva, vento, energia ou clima do cafezal; eu consulto o RAG e aciono o agente certo quando precisar.',
    },
];

const agentNames: Record<string, string> = {
    ar: 'Ar',
    chuva: 'Chuva',
    eletricidade: 'Eletricidade',
    radiacao: 'Radiacao',
    solo: 'Solo',
    vento: 'Vento',
};

export const Route = createFileRoute('/dashboard')({
    component: RouteComponent,
});

function getAgentName(agentId: string | null) {
    if (!agentId) {
        return null;
    }

    return agentNames[agentId] ?? agentId;
}

function getRouteLabel(status: OrchestratorStatus) {
    const agentName = getAgentName(status.selectedAgent);
    if (agentName) {
        return `Encaminhado para ${agentName}`;
    }

    if (status.route === 'direct') {
        return 'Resposta direta';
    }

    return 'Aguardando pergunta';
}

function getRagLabel(status: OrchestratorStatus) {
    if (status.ragEnabled) {
        return `${status.sourceCount} fonte${status.sourceCount === 1 ? '' : 's'} RAG`;
    }

    return 'RAG sem contexto';
}

function applyDoneMetadata(event: PrimaryAiDoneEvent, message: Message): Message {
    if (message.role === 'trace') {
        return message;
    }

    const agentName = event.agentResult?.agentName ?? getAgentName(event.selectedAgent);

    return {
        ...message,
        agentName,
        text: message.text || event.response,
    };
}

function isChatMessage(
    message: Message,
): message is Extract<Message, { role: 'assistant' | 'user' }> {
    return message.role !== 'trace';
}

function formatScore(score: number) {
    return score.toFixed(3);
}

function TraceMessage({
    trace,
    isThinking,
}: {
    trace: OrchestratorTrace | null;
    isThinking: boolean;
}) {
    if (!trace) {
        return (
            <article className="dashboard-trace" aria-live="polite">
                <details className="dashboard-trace-accordion" open>
                    <summary className={isThinking ? 'dashboard-trace-thinking' : undefined}>
                        Thinking
                    </summary>
                    <p>Analisando RAG, rota e agente necessario.</p>
                </details>
            </article>
        );
    }

    return (
        <article className="dashboard-trace" aria-live="polite">
            <details className="dashboard-trace-accordion" open>
                <summary className={isThinking ? 'dashboard-trace-thinking' : undefined}>
                    Thinking
                </summary>
                <div>
                    <ul>
                        {trace.thinking.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </div>
            </details>

            <details className="dashboard-trace-accordion" open>
                <summary>Agent calling</summary>
                <p>
                    {trace.agentCall.called
                        ? `${trace.agentCall.agentName} executou ${trace.agentCall.action}.`
                        : 'Nenhum agente chamado. Resposta direta pelo orquestrador.'}
                </p>
            </details>

            <details className="dashboard-trace-accordion" open>
                <summary>References</summary>
                {trace.references.length > 0 ? (
                    <ul>
                        {trace.references.map((source) => (
                            <li key={source.key}>
                                <span>{source.key}</span>
                                <small>score {formatScore(source.score)}</small>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>Nenhuma referencia RAG retornada para esta pergunta.</p>
                )}
            </details>
        </article>
    );
}

function RouteComponent() {
    const navigate = useNavigate();
    const session = authClient.useSession();
    const [messages, setMessages] = useState<Array<Message>>(initialMessages);
    const [draft, setDraft] = useState('');
    const [chatError, setChatError] = useState<string | null>(null);
    const [status, setStatus] = useState<OrchestratorStatus>({
        route: null,
        selectedAgent: null,
        sourceCount: 0,
        ragEnabled: false,
    });

    useEffect(() => {
        if (!session.isPending && !session.data) {
            void navigate({ to: '/signin' });
        }
    }, [navigate, session.data, session.isPending]);

    const userName = session.data?.user?.name || 'Cafezal';

    const chatMutation = useMutation({
        mutationFn: async (input: ChatMutationInput) => {
            await streamPrimaryAiChat(
                {
                    conversationId: input.conversationId,
                    messages: input.messages,
                },
                {
                    onStart: (event) => {
                        setStatus({
                            route: event.route,
                            selectedAgent: event.selectedAgent,
                            sourceCount: event.rag.sourceCount,
                            ragEnabled: event.rag.enabled,
                        });
                    },
                    onTrace: (event) => {
                        setMessages((current) =>
                            current.map((message) =>
                                message.id === input.traceMessageId && message.role === 'trace'
                                    ? {
                                          ...message,
                                          trace: event,
                                      }
                                    : message,
                            ),
                        );
                    },
                    onDelta: (delta) => {
                        setMessages((current) =>
                            current.map((message) =>
                                message.id === input.assistantMessageId && isChatMessage(message)
                                    ? {
                                          ...message,
                                          text: `${message.text}${delta}`,
                                      }
                                    : message,
                            ),
                        );
                    },
                    onDone: (event) => {
                        setStatus({
                            route: event.route,
                            selectedAgent: event.selectedAgent,
                            sourceCount: event.rag.sourceCount,
                            ragEnabled: event.rag.enabled,
                        });
                        setMessages((current) =>
                            current.map((message) =>
                                message.id === input.assistantMessageId
                                    ? applyDoneMetadata(event, message)
                                    : message,
                            ),
                        );
                    },
                },
            );
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Falha ao conectar com a IA.';
            setChatError(message);
        },
    });

    async function handleSignOut() {
        await authClient.signOut();
        await navigate({ to: '/signin' });
    }

    function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault();

        if (chatMutation.isPending) {
            return;
        }

        const question = draft.trim();
        if (!question) {
            return;
        }

        const userMessage: Message = {
            id: Date.now(),
            role: 'user',
            text: question,
        };

        const traceMessage: Message = {
            id: Date.now() + 1,
            role: 'trace',
            trace: null,
        };

        const assistantMessage: Message = {
            id: Date.now() + 2,
            role: 'assistant',
            text: '',
        };

        const history = messages
            .concat(userMessage)
            .filter(isChatMessage)
            .filter((message) => message.text.trim().length > 0)
            .map<PrimaryAiMessage>((message) => ({
                role: message.role === 'user' ? 'user' : 'assistant',
                content: message.text,
            }));

        setMessages((current) => [...current, userMessage, traceMessage, assistantMessage]);
        setDraft('');
        setChatError(null);

        chatMutation.mutate({
            conversationId: `orchestrator-${session.data?.user?.id ?? 'anonymous'}`,
            messages: history,
            traceMessageId: traceMessage.id,
            assistantMessageId: assistantMessage.id,
        });
    }

    if (session.isPending) {
        return (
            <main className="dashboard-page dashboard-page-loading">
                <section className="dashboard-loading" aria-live="polite">
                    <Radio aria-hidden="true" size={18} />
                    Carregando sessao
                </section>
            </main>
        );
    }

    if (!session.data) {
        return null;
    }

    return (
        <main className="dashboard-page">
            <section className="dashboard-shell" aria-labelledby="dashboard-title">
                <header className="dashboard-topbar">
                    <div>
                        <p className="dashboard-eyebrow">Smart dashboard</p>
                        <h1 id="dashboard-title">Orquestrador Smart</h1>
                    </div>

                    <div className="dashboard-session">
                        <span>{userName}</span>
                        <Button
                            aria-label="Sair"
                            className="dashboard-icon-button"
                            type="button"
                            onClick={handleSignOut}
                        >
                            <LogOut aria-hidden="true" size={16} />
                        </Button>
                    </div>
                </header>

                <div className="dashboard-grid dashboard-grid-orchestrator">
                    <section
                        className="dashboard-chat dashboard-chat-orchestrator"
                        aria-label="Chat com o orquestrador"
                    >
                        <div className="dashboard-chat-header">
                            <div>
                                <p>Roteamento com RAG Cloudflare</p>
                                <h2>Chat central</h2>
                            </div>
                            <span>
                                <ShieldCheck aria-hidden="true" size={15} />
                                Orquestrador
                            </span>
                        </div>

                        <div className="dashboard-route-hint" aria-live="polite">
                            <MessageSquare aria-hidden="true" size={15} />
                            <span>{getRouteLabel(status)}</span>
                            <small>{getRagLabel(status)}</small>
                        </div>

                        <div className="dashboard-messages" aria-live="polite">
                            {messages.map((message) => {
                                if (message.role === 'trace') {
                                    return (
                                        <TraceMessage
                                            key={message.id}
                                            isThinking={chatMutation.isPending}
                                            trace={message.trace}
                                        />
                                    );
                                }

                                if (message.role === 'assistant' && !message.text) {
                                    return null;
                                }

                                return (
                                    <article
                                        className={`dashboard-message dashboard-message-${
                                            message.role === 'user' ? 'user' : 'agent'
                                        }`}
                                        key={message.id}
                                    >
                                        {message.role === 'user' ? (
                                            <p className="dashboard-message-content">
                                                {message.text}
                                            </p>
                                        ) : (
                                            <div className="dashboard-message-content dashboard-message-markdown">
                                                <ReactMarkdown>{message.text}</ReactMarkdown>
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                            {chatError ? (
                                <article className="dashboard-message dashboard-message-agent">
                                    <p className="dashboard-message-content">{chatError}</p>
                                </article>
                            ) : null}
                        </div>

                        <form className="dashboard-composer" onSubmit={handleSubmit}>
                            <Field.Root className="dashboard-field" name="question">
                                <div className="dashboard-input-row">
                                    <Input
                                        aria-label="Pergunta para o orquestrador"
                                        className="dashboard-input"
                                        placeholder="Pergunte sobre solo, chuva, vento, energia ou clima do cafezal."
                                        value={draft}
                                        onChange={(event) => setDraft(event.target.value)}
                                    />
                                    <Button
                                        aria-label="Enviar pergunta"
                                        className="dashboard-send"
                                        disabled={!draft.trim() || chatMutation.isPending}
                                        type="submit"
                                    >
                                        <ArrowUp aria-hidden="true" size={16} />
                                    </Button>
                                </div>
                            </Field.Root>
                        </form>
                    </section>
                </div>
            </section>
        </main>
    );
}
