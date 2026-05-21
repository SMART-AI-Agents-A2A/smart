import { type SyntheticEvent, useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@base-ui/react/button';
import { Field } from '@base-ui/react/field';
import { Input } from '@base-ui/react/input';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, Bell, LogOut, MessageSquare, ShieldCheck } from 'lucide-react';
import { authClient } from '../user/api/auth-client';
import { DashboardTraceMessage } from './components/dashboard-trace-message';
import { initialMessages } from './dashboard.constants';
import {
    applyDoneMetadata,
    getRagLabel,
    getRouteLabel,
    isChatMessage,
    streamPrimaryAiChat,
} from './dashboard.service';
import type {
    ChatMutationInput,
    DashboardMessage,
    DashboardTab,
    OrchestratorStatus,
    PrimaryAiMessage,
} from './dashboard.type';

export const Route = createFileRoute('/dashboard')({
    component: RouteComponent,
});

function RouteComponent() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<DashboardTab>('chatbot');
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [userName, setUserName] = useState('Cafezal');
    const [messages, setMessages] = useState<Array<DashboardMessage>>(initialMessages);
    const [draft, setDraft] = useState('');
    const [chatError, setChatError] = useState<string | null>(null);
    const [status, setStatus] = useState<OrchestratorStatus>({
        route: null,
        selectedAgent: null,
        sourceCount: 0,
        ragEnabled: false,
    });

    useEffect(() => {
        let mounted = true;

        async function checkSession() {
            const response = await authClient.getSession();
            if (!mounted) {
                return;
            }

            if (!response.data?.session) {
                await navigate({ to: '/signin' });
                return;
            }

            setUserId(response.data.user?.id ?? null);
            setUserName(response.data.user?.name || 'Cafezal');
            setIsCheckingSession(false);
        }

        void checkSession();

        return () => {
            mounted = false;
        };
    }, [navigate]);

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

    if (isCheckingSession) {
        return (
            <main className="dashboard-page dashboard-page-loading">
                <section className="dashboard-loading" aria-live="polite">
                    Carregando sessao
                </section>
            </main>
        );
    }

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

        const userMessage: DashboardMessage = {
            id: Date.now(),
            role: 'user',
            text: question,
        };

        const traceMessage: DashboardMessage = {
            id: Date.now() + 1,
            role: 'trace',
            trace: null,
        };

        const assistantMessage: DashboardMessage = {
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
            conversationId: `orchestrator-${userId ?? 'anonymous'}`,
            messages: history,
            traceMessageId: traceMessage.id,
            assistantMessageId: assistantMessage.id,
        });
    }

    return (
        <main className="dashboard-page">
            <section className="dashboard-layout" aria-label="Dashboard">
                <aside className="dashboard-sidebar" aria-label="Navegacao principal">
                    <header className="dashboard-sidebar-header">
                        <p className="dashboard-eyebrow">Organization</p>
                        <h1>Faz_NSAAB</h1>
                    </header>

                    <nav className="dashboard-sidebar-nav" aria-label="Abas principais">
                        <button
                            className="dashboard-sidebar-link"
                            data-active={activeTab === 'chatbot' ? 'true' : undefined}
                            type="button"
                            onClick={() => setActiveTab('chatbot')}
                        >
                            <MessageSquare aria-hidden="true" size={16} />
                            <span>Chatbot</span>
                        </button>
                        <button
                            className="dashboard-sidebar-link"
                            data-active={activeTab === 'alerts' ? 'true' : undefined}
                            type="button"
                            onClick={() => setActiveTab('alerts')}
                        >
                            <Bell aria-hidden="true" size={16} />
                            <span>Alerts</span>
                        </button>
                    </nav>

                    <footer className="dashboard-sidebar-footer">
                        <div className="dashboard-sidebar-user">
                            <small>Signed in</small>
                            <strong>{userName}</strong>
                        </div>
                        <Button
                            aria-label="Sair"
                            className="dashboard-sidebar-logout"
                            type="button"
                            onClick={handleSignOut}
                        >
                            <LogOut aria-hidden="true" size={16} />
                            <span>Logout</span>
                        </Button>
                    </footer>
                </aside>

                <section className="dashboard-content">
                    {activeTab === 'chatbot' ? (
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
                                            <DashboardTraceMessage
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
                    ) : (
                        <section className="dashboard-chat dashboard-alerts" aria-label="Alerts">
                            <header className="dashboard-chat-header">
                                <div>
                                    <p>Monitoramento</p>
                                    <h2>Alerts</h2>
                                </div>
                            </header>

                            <div className="dashboard-alerts-empty">
                                <Bell aria-hidden="true" size={18} />
                                <strong>Nenhum alerta ativo no momento.</strong>
                                <p>
                                    Esta aba vai consolidar eventos importantes da organizacao
                                    Faz_NSAAB.
                                </p>
                            </div>
                        </section>
                    )}
                </section>
            </section>
        </main>
    );
}
