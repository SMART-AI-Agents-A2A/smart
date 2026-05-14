import { Hono } from 'hono';
import { orchestratorAgentCard, rainAgentCard, soilAgentCard } from './a2a.cards';
import { orchestratorMessageSendHandler, rainMessageSendHandler } from './a2a.handlers';
import { createA2AServer } from './core';
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

export { router as a2aRoutes };
