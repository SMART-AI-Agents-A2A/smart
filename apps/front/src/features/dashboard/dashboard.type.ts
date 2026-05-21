export type PrimaryAiRole = 'user' | 'assistant';
export type OrchestratorRoute = 'direct' | 'agent';

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
