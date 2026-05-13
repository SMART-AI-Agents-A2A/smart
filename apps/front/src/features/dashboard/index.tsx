import { type SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@base-ui/react/button';
import { Field } from '@base-ui/react/field';
import { Input } from '@base-ui/react/input';
import { Tabs } from '@base-ui/react/tabs';
import {
    ArrowUp,
    CheckCircle2,
    Droplets,
    Leaf,
    LogOut,
    MessageSquare,
    Radio,
    ShieldCheck,
} from 'lucide-react';
import { authClient } from '../user/api/auth-client';

type AgentId = 'agua' | 'terra';

type Agent = {
    id: AgentId;
    name: string;
    label: string;
    tone: string;
    summary: string;
    prompt: string;
    icon: typeof Droplets;
};

type Message = {
    id: number;
    agentId: AgentId;
    role: 'agent' | 'user';
    text: string;
};

const agents: Array<Agent> = [
    {
        id: 'agua',
        name: 'Agua',
        label: 'Umidade e irrigacao',
        tone: 'Leitura hidrica',
        summary: 'Solo estavel, revisar talhao baixo antes do meio-dia.',
        prompt: 'Pergunte sobre irrigacao, umidade ou risco de estresse hidrico.',
        icon: Droplets,
    },
    {
        id: 'terra',
        name: 'Terra',
        label: 'Solo e nutricao',
        tone: 'Leitura de solo',
        summary: 'Nutricao sem alerta critico, coletar amostra no setor norte.',
        prompt: 'Pergunte sobre solo, nutricao, manejo ou preparo do cafezal.',
        icon: Leaf,
    },
];

const initialMessages: Array<Message> = [
    {
        id: 1,
        agentId: 'agua',
        role: 'agent',
        text: 'Agua pronto. Posso ajudar a priorizar irrigacao e risco de estresse hidrico.',
    },
    {
        id: 2,
        agentId: 'terra',
        role: 'agent',
        text: 'Terra pronto. Posso organizar sinais de solo, nutricao e manejo.',
    },
];

const signals = [
    { label: 'Talhao baixo', value: 'Revisar hoje', status: 'Atencao' },
    { label: 'Solo norte', value: 'Amostra pendente', status: 'Coleta' },
    { label: 'Manejo', value: 'Sem alerta critico', status: 'Ok' },
];

export const Route = createFileRoute('/dashboard')({
    component: RouteComponent,
});

function RouteComponent() {
    const navigate = useNavigate();
    const session = authClient.useSession();
    const [activeAgent, setActiveAgent] = useState<AgentId>('agua');
    const [messages, setMessages] = useState<Array<Message>>(initialMessages);
    const [draft, setDraft] = useState('');

    useEffect(() => {
        if (!session.isPending && !session.data) {
            void navigate({ to: '/signin' });
        }
    }, [navigate, session.data, session.isPending]);

    const currentAgent = useMemo(
        () => agents.find((agent) => agent.id === activeAgent) ?? agents[0],
        [activeAgent],
    );

    const visibleMessages = messages.filter((message) => message.agentId === activeAgent);
    const userName = session.data?.user?.name || 'Cafezal';

    async function handleSignOut() {
        await authClient.signOut();
        await navigate({ to: '/signin' });
    }

    function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault();

        const question = draft.trim();
        if (!question) {
            return;
        }

        setMessages((current) => [
            ...current,
            {
                id: Date.now(),
                agentId: activeAgent,
                role: 'user',
                text: question,
            },
            {
                id: Date.now() + 1,
                agentId: activeAgent,
                role: 'agent',
                text: 'Recebi. Esta primeira versao ainda nao chama o agente real, mas a conversa ja esta pronta para conectar ao endpoint.',
            },
        ]);
        setDraft('');
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
                        <h1 id="dashboard-title">Agentes do cafezal</h1>
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

                <div className="dashboard-grid">
                    <aside className="dashboard-panel dashboard-agents" aria-label="Agentes">
                        <div className="dashboard-panel-header">
                            <span>Agentes</span>
                            <strong>2 ativos</strong>
                        </div>

                        <Tabs.Root
                            className="dashboard-tabs"
                            value={activeAgent}
                            onValueChange={(value) => setActiveAgent(value as AgentId)}
                        >
                            <Tabs.List
                                className="dashboard-agent-list"
                                aria-label="Selecionar agente"
                            >
                                {agents.map((agent) => {
                                    const Icon = agent.icon;
                                    return (
                                        <Tabs.Tab
                                            className="dashboard-agent-tab"
                                            key={agent.id}
                                            value={agent.id}
                                        >
                                            <Icon aria-hidden="true" size={17} />
                                            <span>
                                                <strong>{agent.name}</strong>
                                                {agent.label}
                                            </span>
                                        </Tabs.Tab>
                                    );
                                })}
                            </Tabs.List>
                        </Tabs.Root>
                    </aside>

                    <section
                        className="dashboard-chat"
                        aria-label={`Conversa com ${currentAgent.name}`}
                    >
                        <div className="dashboard-chat-header">
                            <div>
                                <p>{currentAgent.tone}</p>
                                <h2>{currentAgent.name}</h2>
                            </div>
                            <span>
                                <ShieldCheck aria-hidden="true" size={15} />
                                Local
                            </span>
                        </div>

                        <div className="dashboard-messages" aria-live="polite">
                            {visibleMessages.map((message) => (
                                <article
                                    className={`dashboard-message dashboard-message-${message.role}`}
                                    key={message.id}
                                >
                                    <span>
                                        {message.role === 'user' ? 'Voce' : currentAgent.name}
                                    </span>
                                    <p>{message.text}</p>
                                </article>
                            ))}
                        </div>

                        <form className="dashboard-composer" onSubmit={handleSubmit}>
                            <Field.Root className="dashboard-field" name="question">
                                <Field.Label className="dashboard-label">
                                    Pergunta para {currentAgent.name}
                                </Field.Label>
                                <div className="dashboard-input-row">
                                    <Input
                                        className="dashboard-input"
                                        placeholder={currentAgent.prompt}
                                        value={draft}
                                        onChange={(event) => setDraft(event.target.value)}
                                    />
                                    <Button
                                        aria-label="Enviar pergunta"
                                        className="dashboard-send"
                                        disabled={!draft.trim()}
                                        type="submit"
                                    >
                                        <ArrowUp aria-hidden="true" size={16} />
                                    </Button>
                                </div>
                            </Field.Root>
                        </form>
                    </section>

                    <aside
                        className="dashboard-panel dashboard-context"
                        aria-label="Sinais do cafezal"
                    >
                        <div className="dashboard-panel-header">
                            <span>Agora</span>
                            <strong>3 sinais</strong>
                        </div>

                        <div className="dashboard-agent-summary">
                            <MessageSquare aria-hidden="true" size={18} />
                            <p>{currentAgent.summary}</p>
                        </div>

                        <div className="dashboard-signal-list">
                            {signals.map((signal) => (
                                <article className="dashboard-signal" key={signal.label}>
                                    <div>
                                        <span>{signal.label}</span>
                                        <strong>{signal.value}</strong>
                                    </div>
                                    <small>
                                        <CheckCircle2 aria-hidden="true" size={13} />
                                        {signal.status}
                                    </small>
                                </article>
                            ))}
                        </div>
                    </aside>
                </div>
            </section>
        </main>
    );
}
