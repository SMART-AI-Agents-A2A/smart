import type { AiChatInbound, AiChatMessage } from './ai.vo';

export type { AiChatInbound, AiChatMessage };

export type AgentId = 'ar' | 'chuva' | 'eletricidade' | 'radiacao' | 'solo' | 'vento';

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
};

export type UpstreamSelection = {
    stream: ReadableStream;
    gatewayId: string | null;
    usedRagContext: boolean;
};

export type AgentDefinition = {
    id: AgentId;
    name: string;
    responsibility: string;
    triggers: Array<string>;
    action: string;
};

export type OrchestratorDecision = {
    route: 'direct' | 'agent';
    selectedAgent: AgentId | null;
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

export type StoredChatMessage = {
    role: 'user' | 'assistant';
    content: string;
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
