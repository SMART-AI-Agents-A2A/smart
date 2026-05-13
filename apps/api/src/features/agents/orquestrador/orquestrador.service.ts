import { v4 as uuidv4 } from 'uuid';
import { defaultFarmCode } from '../tools/influxdb/influxdb.types';
import { selectAgentFromA2ACards } from './orquestrador.catalog';
import type { OrquestradorChatRequest, OrquestradorChatResponse } from './orquestrador.schemas';

const pendingDelegationAnswer = 'Agente A2A compatível selecionado para delegação.';

const unknownAgentAnswer = 'Nenhum agente A2A foi selecionado para delegação.';

export const createOrquestradorChatResponse = (
    request: OrquestradorChatRequest,
): OrquestradorChatResponse => {
    const routing = selectAgentFromA2ACards(request.targetAgent);

    return {
        requestId: uuidv4(),
        farmCode: defaultFarmCode,
        intent: routing.intent,
        answer: routing.delegation ? pendingDelegationAnswer : unknownAgentAnswer,
        delegation: routing.delegation,
        metadata: {
            ...request.metadata,
            receivedText: request.message,
            routingMode: 'a2a-agent-card-explicit-selection',
            delegated: false,
        },
    };
};
