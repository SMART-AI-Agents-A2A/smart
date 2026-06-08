// Registry of selectable LLMs routed through OpenRouter via the Cloudflare AI Gateway.
// Internal ids decouple the frontend/contract from provider slugs. The `slug` is the
// OpenRouter model id consumed by the gateway's OpenRouter endpoint
// (https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/openrouter/v1/chat/completions).
// Each slug must exist in the OpenRouter catalog (https://openrouter.ai/models); note the
// provider prefixes differ from the raw vendor names (e.g. moonshotai/*, z-ai/*).
//
// Keep `apps/front/src/features/dashboard/dashboard.constants.ts#aiModels` in sync with
// the labels/ids exposed here.

export type AiModelDefinition = {
    label: string;
    slug: string;
};

export const AI_MODELS = {
    'claude-sonnet-4-6': {
        label: 'Claude Sonnet 4.6',
        slug: 'anthropic/claude-sonnet-4.6',
    },
    'gpt-5-4': {
        label: 'GPT-5.4',
        slug: 'openai/gpt-5.4',
    },
    'kimi-k2-7': {
        label: 'Kimi K2.6',
        slug: 'moonshotai/kimi-k2.6',
    },
    'glm-5-1': {
        label: 'GLM-5.1',
        slug: 'z-ai/glm-5.1',
    },
} as const satisfies Record<string, AiModelDefinition>;

export type AiModelId = keyof typeof AI_MODELS;

export const AI_MODEL_IDS = Object.keys(AI_MODELS) as [AiModelId, ...Array<AiModelId>];

export const DEFAULT_AI_MODEL_ID: AiModelId = 'claude-sonnet-4-6';

export function resolveModelId(modelId: string | null | undefined): AiModelId {
    return modelId && modelId in AI_MODELS ? (modelId as AiModelId) : DEFAULT_AI_MODEL_ID;
}
