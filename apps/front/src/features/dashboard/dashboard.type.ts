export type PrimaryAiRole = 'user' | 'assistant';
export type OrchestratorRoute = 'direct' | 'agent';
export type PrimaryAiStatusPhase = 'thinking' | 'agent-calling' | 'responding';
export type PrimaryAiStatusState = 'active' | 'complete';

export type RagSource = {
    key: string;
    score: number;
};

export type AgentExecutionResult = {
    agentId: string;
    agentName: string;
    status: 'completed';
    action: string;
    summary: string;
    details: Array<string>;
    usedRagSources: Array<RagSource>;
};

export type OrchestratorTrace = {
    thinking: Array<string>;
    route: OrchestratorRoute;
    selectedAgent: string | null;
    agentCall: {
        called: boolean;
        agentId: string | null;
        agentName: string | null;
        action: string | null;
        status: 'completed' | 'skipped';
        summary: string;
    };
    references: Array<RagSource>;
};

export type PrimaryAiMessage = {
    role: PrimaryAiRole;
    content: string;
};

export type PrimaryAiChatInbound = {
    messages: Array<PrimaryAiMessage>;
    conversationId?: string;
};

export type PrimaryAiRag = {
    instance: string;
    sources: Array<RagSource>;
    sourceCount: number;
    enabled: boolean;
};

export type PrimaryAiStartEvent = {
    conversationId: string | null;
    model: string;
    gatewayId: string | null;
    orchestrator: boolean;
    route: OrchestratorRoute;
    selectedAgent: string | null;
    rag: PrimaryAiRag;
};

export type PrimaryAiStatusEvent = {
    phase: PrimaryAiStatusPhase;
    state: PrimaryAiStatusState;
    message: string;
    agentId?: string | null;
    agentName?: string | null;
};

export type PrimaryAiDoneEvent = {
    response: string;
    model: string;
    gatewayId: string | null;
    orchestrator: boolean;
    route: OrchestratorRoute;
    selectedAgent: string | null;
    agentResult: AgentExecutionResult | null;
    trace: OrchestratorTrace;
    rag: PrimaryAiRag;
};

export type PrimaryAiEventHandlers = {
    onStart?: (payload: PrimaryAiStartEvent) => void;
    onStatus?: (payload: PrimaryAiStatusEvent) => void;
    onTrace?: (payload: OrchestratorTrace) => void;
    onDelta?: (delta: string) => void;
    onDone?: (payload: PrimaryAiDoneEvent) => void;
};

export type DashboardChatMessage = {
    id: number;
    role: 'assistant' | 'user';
    text: string;
    agentName?: string | null;
};

export type DashboardTraceMessage = {
    id: number;
    role: 'trace';
    trace: OrchestratorTrace | null;
    thinking: Array<string>;
    activePhase: PrimaryAiStatusPhase | null;
    agentId?: string | null;
    agentName?: string | null;
    agentStatus?: string | null;
};

export type DashboardMessage = DashboardChatMessage | DashboardTraceMessage;

export type ChatMutationInput = {
    conversationId: string;
    messages: Array<PrimaryAiMessage>;
    traceMessageId: number;
    assistantMessageId: number;
};

export type OrchestratorStatus = {
    route: OrchestratorRoute | null;
    selectedAgent: string | null;
    sourceCount: number;
    ragEnabled: boolean;
};

export type DashboardTab = 'chatbot' | 'alerts';
