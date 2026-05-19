import { Hono } from 'hono';
import { orchestratorAgentCard, rainAgentCard, soilAgentCard } from './a2a.cards';
import { orchestratorMessageSendHandler } from './a2a.handlers';
import { airAgentCard, airMessageSendHandler } from './ar';
import { rainMessageSendHandler } from './chuva';
import { createA2AServer } from './core';
import { radiationAgentCard, radiationMessageSendHandler } from './radiacao';
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

router.route(
    '/agents/ar',
    createA2AServer({
        card: airAgentCard,
        onMessageSend: airMessageSendHandler,
    }),
);

export { router as a2aRoutes };
