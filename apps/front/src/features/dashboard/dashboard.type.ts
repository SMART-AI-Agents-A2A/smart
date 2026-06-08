export type PrimaryAiRole = 'user' | 'assistant';
export type OrchestratorRoute = 'direct' | 'agent' | 'multi-agent';

// Mirror of the backend registry in apps/api/src/features/ai/ai.models.ts.
export type AiModelId = 'claude-sonnet-4-6' | 'gpt-5-4' | 'kimi-k2-7' | 'glm-5-1';

export type AiModelOption = {
    id: AiModelId;
    label: string;
};
export type PrimaryAiStatusPhase = 'thinking' | 'agent-calling' | 'responding';
export type PrimaryAiStatusState = 'active' | 'complete';

export type RagSource = {
    key: string;
    score: number;
};

export type AgentExecutionResult = {
    agentId: string;
    agentName: string;
    status: 'completed' | 'input-required' | 'failed';
    action: string;
    summary: string;
    details: Array<string>;
    usedRagSources: Array<RagSource>;
    agentResponseText?: string | null;
    callData?: Record<string, unknown>;
    evidence?: AgentEvidence;
};

export type AgentEvidence = {
    provider: 'influxdb' | 'openweather' | 'mixed' | 'unknown';
    mcpTools: Array<string>;
    requestedRange?: {
        start?: string;
        stop?: string;
        every?: string;
    };
    timestamps: Array<string>;
    latestTimestamp: string | null;
    values: Array<{
        label: string;
        value: number;
        rawValue?: number | null;
        unit: string | null;
        rawUnit?: string | null;
        timestamp: string | null;
    }>;
    notes: Array<string>;
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
        status: 'completed' | 'input-required' | 'failed' | 'skipped';
        summary: string;
    };
    references: Array<RagSource>;
};

export type PrimaryAiMessage = {
    role: PrimaryAiRole;
    content: string;
};

export type StoredChatMessage = PrimaryAiMessage;

export type PrimaryAiChatInbound = {
    messages: Array<PrimaryAiMessage>;
    conversationId?: string;
    model?: AiModelId;
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
    agentResults?: Array<AgentExecutionResult>;
    trace: OrchestratorTrace;
    rag: PrimaryAiRag;
};

export type PrimaryAiEventHandlers = {
    onHistory?: (messages: Array<StoredChatMessage>) => void;
    onCleared?: () => void;
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

export type AgentMessage =
    | { type: 'history'; data: { messages: Array<StoredChatMessage> } }
    | { type: 'cleared'; data: Record<string, never> }
    | { type: 'start'; data: PrimaryAiStartEvent }
    | { type: 'status'; data: PrimaryAiStatusEvent }
    | { type: 'trace'; data: OrchestratorTrace }
    | { type: 'delta'; data: { delta: string } }
    | { type: 'done'; data: PrimaryAiDoneEvent }
    | { type: 'error'; data: { message: string } };

export type AgentOutgoingMessage =
    | {
          type: 'chat';
          payload: PrimaryAiChatInbound;
      }
    | {
          type: 'clear';
      };
