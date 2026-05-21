import type { SmartScreenContent, SmartStageCard } from './smart.type';

export const smartScreenContent: SmartScreenContent = {
    statusLabel: 'Smart · 0 pendencias',
    weekLabel: 'Hoje',
    weekValue: '12 resolvidas',
    kicker: 'Tudo no lugar',
    title: 'Seu trabalho em ordem.',
    description: 'Agents para consultar metricas do cafezal e decidir o proximo manejo.',
};

export const smartStageCards: Array<SmartStageCard> = [
    {
        key: 'main',
        label: 'Agora',
        value: 'Quieto',
        className: 'smart-card smart-card-main',
    },
    {
        key: 'left',
        label: 'Entrada',
        value: 'Limpa',
        className: 'smart-card smart-card-left',
    },
    {
        key: 'right',
        label: 'Foco',
        value: 'Livre',
        className: 'smart-card smart-card-right',
    },
];
