import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAgent } from 'agents/react';
import { Button } from '@base-ui/react/button';
import { Field } from '@base-ui/react/field';
import { Input } from '@base-ui/react/input';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, Bell, LogOut, MessageSquare, ShieldCheck, Trash2 } from 'lucide-react';
import { authClient } from '../user/api/auth-client';
import { DashboardModelSelect } from './components/dashboard-model-select';
import { DashboardTraceMessage } from './components/dashboard-trace-message';
import { initialMessages, apiOrigin, defaultAiModelId } from './dashboard.constants';
import {
    applyDoneMetadata,
    applyStatusMetadata,
    getRagLabel,
    getRouteLabel,
    isChatMessage,
    processAgentMessage,
    toDashboardMessages,
} from './dashboard.service';
import type {
    AiModelId,
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
    const [model, setModel] = useState<AiModelId>(defaultAiModelId);
    const [chatError, setChatError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);
    const [status, setStatus] = useState<OrchestratorStatus>({
        route: null,
        selectedAgent: null,
        sourceCount: 0,
        ragEnabled: false,
    });

    const pendingIdsRef = useRef<{ traceId: number; assistantId: number } | null>(null);

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

    const agent = useAgent({
        host: apiOrigin,
        agent: 'SmartAgent',
        name: userId ?? 'anonymous',
        onMessage: (event: MessageEvent<string>) => {
            const ids = pendingIdsRef.current;

            try {
                const isDone = processAgentMessage(event.data, {
                    onHistory: (storedMessages) => {
                        if (!pendingIdsRef.current) {
                            setMessages(toDashboardMessages(storedMessages));
                        }
                    },
                    onCleared: () => {
                        pendingIdsRef.current = null;
                        setIsPending(false);
                        setChatError(null);
                        setMessages(initialMessages);
                        setStatus({
                            route: null,
                            selectedAgent: null,
                            sourceCount: 0,
                            ragEnabled: false,
                        });
                    },
                    onStart: (e) => {
                        setStatus({
                            route: e.route,
                            selectedAgent: e.selectedAgent,
                            sourceCount: e.rag.sourceCount,
                            ragEnabled: e.rag.enabled,
                        });
                    },
                    onStatus: (e) => {
                        if (!ids) return;
                        const { traceId } = ids;
                        setMessages((current) =>
                            current.map((msg) =>
                                msg.id === traceId ? applyStatusMetadata(e, msg) : msg,
                            ),
                        );
                    },
                    onTrace: (e) => {
                        if (!ids) return;
                        const { traceId } = ids;
                        setMessages((current) =>
                            current.map((msg) =>
                                msg.id === traceId && msg.role === 'trace'
                                    ? {
                                          ...msg,
                                          trace: e,
                                          agentId: e.agentCall.agentId,
                                          agentName: e.agentCall.agentName,
                                          agentStatus: null,
                                      }
                                    : msg,
                            ),
                        );
                    },
                    onDelta: (delta) => {
                        if (!ids) return;
                        const { assistantId } = ids;
                        setMessages((current) =>
                            current.map((msg) =>
                                msg.id === assistantId && isChatMessage(msg)
                                    ? { ...msg, text: `${msg.text}${delta}` }
                                    : msg,
                            ),
                        );
                    },
                    onDone: (e) => {
                        if (!ids) return;
                        const { traceId, assistantId } = ids;
                        setStatus({
                            route: e.route,
                            selectedAgent: e.selectedAgent,
                            sourceCount: e.rag.sourceCount,
                            ragEnabled: e.rag.enabled,
                        });
                        setMessages((current) =>
                            current.map((msg) => {
                                if (msg.id === assistantId) return applyDoneMetadata(e, msg);
                                if (msg.id === traceId && msg.role === 'trace')
                                    return {
                                        ...msg,
                                        trace: e.trace,
                                        activePhase: null,
                                        agentId: e.trace.agentCall.agentId,
                                        agentName: e.trace.agentCall.agentName,
                                        agentStatus: null,
                                    };
                                return msg;
                            }),
                        );
                        setIsPending(false);
                        pendingIdsRef.current = null;
                    },
                });

                if (isDone) {
                    setIsPending(false);
                    pendingIdsRef.current = null;
                }
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : 'Falha ao conectar com a IA.';
                setChatError(message);
                if (ids) {
                    const { traceId } = ids;
                    setMessages((current) =>
                        current.map((msg) =>
                            msg.id === traceId && msg.role === 'trace'
                                ? { ...msg, activePhase: null }
                                : msg,
                        ),
                    );
                }
                setIsPending(false);
                pendingIdsRef.current = null;
            }
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

    function handleClearChat() {
        if (isPending) {
            return;
        }

        agent.send(JSON.stringify({ type: 'clear' }));
    }

    function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault();

        if (isPending) {
            return;
        }

        const question = draft.trim();
        if (!question) {
            return;
        }

        const now = Date.now();
        const userMessage: DashboardMessage = {
            id: now,
            role: 'user',
            text: question,
        };

        const traceMessage: DashboardMessage = {
            id: now + 1,
            role: 'trace',
            trace: null,
            thinking: [],
            activePhase: null,
            agentId: null,
            agentName: null,
            agentStatus: null,
        };

        const assistantMessage: DashboardMessage = {
            id: now + 2,
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
        setIsPending(true);
        pendingIdsRef.current = { traceId: traceMessage.id, assistantId: assistantMessage.id };

        agent.send(
            JSON.stringify({
                type: 'chat',
                payload: {
                    conversationId: `orchestrator-${userId ?? 'anonymous'}`,
                    messages: history,
                    model,
                },
            }),
        );
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
                                <div className="dashboard-chat-actions">
                                    <Button
                                        aria-label="Limpar chat"
                                        className="dashboard-icon-button"
                                        disabled={isPending}
                                        type="button"
                                        onClick={handleClearChat}
                                    >
                                        <Trash2 aria-hidden="true" size={15} />
                                    </Button>
                                    <span>
                                        <ShieldCheck aria-hidden="true" size={15} />
                                        Orquestrador
                                    </span>
                                </div>
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
                                                activePhase={message.activePhase}
                                                agentName={message.agentName}
                                                agentStatus={message.agentStatus}
                                                thinking={message.thinking}
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
                                            disabled={!draft.trim() || isPending}
                                            type="submit"
                                        >
                                            <ArrowUp aria-hidden="true" size={16} />
                                        </Button>
                                    </div>
                                    <div className="dashboard-composer-toolbar">
                                        <DashboardModelSelect
                                            disabled={isPending}
                                            onValueChange={setModel}
                                            value={model}
                                        />
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
