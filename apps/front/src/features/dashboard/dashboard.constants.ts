import type { DashboardMessage } from './dashboard.type';

export const apiOrigin = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

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
    solo: 'Solo',
    vento: 'Vento',
};
