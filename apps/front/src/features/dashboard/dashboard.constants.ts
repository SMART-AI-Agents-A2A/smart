import type { DashboardMessage } from './dashboard.type';
export { apiOrigin } from '../../shared/api';

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
