import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { a2aAgentCards, orchestratorAgentCard, rainAgentCard, soilAgentCard } from './a2a.cards';
import { orchestratorMessageSendHandler } from './a2a.handlers';
import { airAgentCard, airMessageSendHandler } from './ar';
import { rainMessageSendHandler } from './chuva';
import { createA2AServer } from './core';
import { lightningAgentCard, lightningMessageSendHandler } from './raios';
import { radiationAgentCard, radiationMessageSendHandler } from './radiacao';
import { soilMessageSendHandler } from './solo';
import { windAgentCard, windMessageSendHandler } from './vento';

const router = new Hono<{ Bindings: CloudflareBindings }>();

const toDiscoveryEntry = ([id, card]: [
    string,
    (typeof a2aAgentCards)[keyof typeof a2aAgentCards],
]) => ({
    id,
    name: card.name,
    description: card.description,
    endpointUrl: card.url,
    agentCardUrl: `${card.url}/.well-known/agent-card.json`,
    version: card.version,
    protocolVersion: card.protocolVersion,
    skills: card.skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        tags: skill.tags,
    })),
    metadata: card.metadata,
});

router.get('/agents', (c) =>
    c.json(
        {
            protocol: 'a2a',
            discovery: {
                type: 'agent-catalog',
                source: '/v1/a2a/agents',
                agentCardPath: '/.well-known/agent-card.json',
            },
            agents: Object.entries(a2aAgentCards)
                .filter(([id]) => id !== 'orchestrator')
                .map(toDiscoveryEntry),
        },
        StatusCodes.OK,
    ),
);

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
    '/agents/raio',
    createA2AServer({
        card: lightningAgentCard,
        onMessageSend: lightningMessageSendHandler,
    }),
);

router.route(
    '/agents/ar',
    createA2AServer({
        card: airAgentCard,
        onMessageSend: airMessageSendHandler,
    }),
);

router.route(
    '/agents/vento',
    createA2AServer({
        card: windAgentCard,
        onMessageSend: windMessageSendHandler,
    }),
);

export { router as a2aRoutes };
