import type { AiChatInbound, AiChatMessage } from './ai.vo';

export type { AiChatInbound, AiChatMessage };

export type AgentId = 'ar' | 'chuva' | 'eletricidade' | 'radiacao' | 'raio' | 'solo' | 'vento';

export type SseEventName = 'start' | 'status' | 'trace' | 'delta' | 'done' | 'error';

export type AiStatusPhase = 'thinking' | 'agent-calling' | 'responding';

export type AiStatusState = 'active' | 'complete';

export type AiStatusEvent = {
    phase: AiStatusPhase;
    state: AiStatusState;
    message: string;
    agentId?: AgentId | null;
    agentName?: string | null;
};

export type ModelMessage = {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
};

export type RagSource = {
    key: string;
    score: number;
};

export type RagContext = {
    contextMessage: string | null;
    sources: Array<RagSource>;
    retrievedContexts?: Array<string>;
};

export type UpstreamSelection = {
    stream: ReadableStream;
    gatewayId: string | null;
    usedRagContext: boolean;
    model: string;
};

export type AgentDefinition = {
    id: AgentId;
    name: string;
    responsibility: string;
    triggers: Array<string>;
    action: string;
};

export type AgentCallPlan = {
    agentId: AgentId;
    data: Record<string, unknown>;
    reason: string;
};

export type OrchestratorDecision = {
    route: 'direct' | 'agent' | 'multi-agent';
    selectedAgent: AgentId | null;
    calls: Array<AgentCallPlan>;
    confidence: number;
    reason: string;
    userGoal: string;
    neededAction: string;
};

export type AgentExecutionResult = {
    agentId: AgentId;
    agentName: string;
    status: 'completed' | 'input-required' | 'failed';
    action: string;
    summary: string;
    details: Array<string>;
    usedRagSources: Array<RagSource>;
    agentResponseText: string | null;
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
    route: OrchestratorDecision['route'];
    selectedAgent: AgentId | null;
    agentCall: {
        called: boolean;
        agentId: AgentId | null;
        agentName: string | null;
        action: string | null;
        status: AgentExecutionResult['status'] | 'skipped';
        summary: string;
    };
    references: Array<RagSource>;
};

export type ModelRunOptions = {
    mode: string;
    maxTokens: number;
    temperature: number;
    responseFormat?: AiTextGenerationResponseFormat;
};

export type StoredAssistantTrace = {
    thinking: Array<string>;
    trace: OrchestratorTrace | null;
};

export type StoredChatMessage = {
    role: 'user' | 'assistant';
    content: string;
    trace?: StoredAssistantTrace;
};

export type SmartAgentState = {
    accountId: string | null;
    conversationMessages: Array<StoredChatMessage>;
};

export type SmartAgentIncomingMessage =
    | {
          type: 'chat';
          payload: AiChatInbound;
      }
    | {
          type: 'clear';
      };
