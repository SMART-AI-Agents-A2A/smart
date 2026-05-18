import { rainAgentCard, soilAgentCard } from '../a2a/a2a.cards';
import type { AgentCard } from '../a2a/core';
import type { OrquestradorRoutingDecision, OrquestradorTargetAgent } from './orquestrador.schemas';

export interface A2ACatalogEntry {
    readonly targetAgent: OrquestradorTargetAgent;
    readonly card: AgentCard;
}

const a2aCatalog: readonly A2ACatalogEntry[] = [
    {
        targetAgent: 'solo',
        card: soilAgentCard,
    },
    {
        targetAgent: 'chuva',
        card: rainAgentCard,
    },
];

export const getOrquestradorA2ACatalog = (): readonly A2ACatalogEntry[] => a2aCatalog;

export const findOrquestradorA2ACatalogEntry = (
    targetAgent: OrquestradorTargetAgent,
): A2ACatalogEntry | undefined => {
    return a2aCatalog.find((entry) => entry.targetAgent === targetAgent);
};

export const selectAgentFromA2ACards = (
    targetAgent?: OrquestradorTargetAgent,
): OrquestradorRoutingDecision => {
    if (!targetAgent) {
        return {
            intent: 'unknown',
        };
    }

    const entry = findOrquestradorA2ACatalogEntry(targetAgent);

    if (!entry) {
        return {
            intent: 'unknown',
        };
    }

    return {
        intent: entry.targetAgent,
        delegation: {
            targetAgent: entry.targetAgent,
            reason: `Agent Card "${entry.card.name}" selecionado pelo catálogo A2A do orquestrador.`,
            agentCardUrl: entry.card.url,
            skillIds: entry.card.skills.map((skill) => skill.id),
        },
    };
};
