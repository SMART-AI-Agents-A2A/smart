import { Hono } from 'hono';
import { orchestratorAgentCard, rainAgentCard, soilAgentCard } from './a2a.cards';
import { orchestratorMessageSendHandler } from './a2a.handlers';
import { rainMessageSendHandler } from './chuva';
import { createA2AServer } from './core';
import { radiationAgentCard } from './radiacao/radiacao.well-know';
import { radiationMessageSendHandler } from './radiacao/radiacao.agent';
import { soilMessageSendHandler } from './solo';

const router = new Hono<{ Bindings: CloudflareBindings }>();

router.route(
    '/orchestrator',
    createA2AServer({
        card: orchestratorAgentCard,
        onMessageSend: orchestratorMessageSendHandler,
    }),
);

router.route(
    '/agents/solo',
    createA2AServer({
        card: soilAgentCard,
        onMessageSend: soilMessageSendHandler,
    }),
);

router.route(
    '/agents/chuva',
    createA2AServer({
        card: rainAgentCard,
        onMessageSend: rainMessageSendHandler,
    }),
);

router.route(
    '/agents/radiacao',
    createA2AServer({
        card: radiationAgentCard,
        onMessageSend: radiationMessageSendHandler,
    }),
);

export { router as a2aRoutes };
