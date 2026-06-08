import type { AiModelId, AiModelOption, DashboardMessage } from './dashboard.type';
export { apiOrigin } from '../../shared/api';

// Mirror of the backend registry in apps/api/src/features/ai/ai.models.ts.
export const aiModels: Array<AiModelOption> = [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'gpt-5-4', label: 'GPT-5.4' },
    { id: 'kimi-k2-7', label: 'Kimi K2.6' },
    { id: 'glm-5-1', label: 'GLM-5.1' },
];

export const defaultAiModelId: AiModelId = 'claude-sonnet-4-6';

export const initialMessages: Array<DashboardMessage> = [
    {
        id: 1,
        role: 'assistant',
        text: 'Sou o Orquestrador Smart. Pergunte sobre solo, chuva, vento, energia ou clima do cafezal; eu consulto o RAG e aciono o agente certo quando precisar.',
    },
];

export const agentNames: Record<string, string> = {
    ar: 'Ar',
    chuva: 'Chuva',
    eletricidade: 'Eletricidade',
    radiacao: 'Radiacao',
    raio: 'Raio',
    solo: 'Solo',
    vento: 'Vento',
};
