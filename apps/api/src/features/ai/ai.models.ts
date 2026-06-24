// Registry of selectable LLMs. Internal ids decouple the frontend/contract from provider
// model names and from the Cloudflare AI Gateway provider path.
//
// Keep `apps/front/src/features/dashboard/dashboard.constants.ts#aiModels` in sync with
// the labels/ids exposed here.

export type AiModelProvider = 'openrouter' | 'openai' | 'workers-ai';

export type AiModelDefinition = {
    label: string;
    provider: AiModelProvider;
    slug: string;
    byokAlias?: string;
};

export const WORKERS_AI_FALLBACK_MODEL_ID = '@cf/qwen/qwen3-30b-a3b-fp8';

export const AI_MODELS = {
    'workers-qwen-30b': {
        label: 'Workers AI Qwen 3 30B',
        provider: 'workers-ai',
        slug: WORKERS_AI_FALLBACK_MODEL_ID,
    },
    'openai-gpt-4o-mini': {
        label: 'OpenAI GPT-4o mini',
        provider: 'openai',
        slug: 'gpt-4o-mini',
        byokAlias: 'openai',
    },
    'claude-sonnet-4-6': {
        label: 'Claude Sonnet 4.6',
        provider: 'openrouter',
        slug: 'anthropic/claude-sonnet-4.6',
        byokAlias: 'openrouter',
    },
    'claude-haiku-4-5': {
        label: 'Claude Haiku 4.5',
        provider: 'openrouter',
        slug: 'anthropic/claude-haiku-4.5',
        byokAlias: 'openrouter',
    },
    'deepseek-v3-2': {
        label: 'DeepSeek V3.2',
        provider: 'openrouter',
        slug: 'deepseek/deepseek-v3.2',
        byokAlias: 'openrouter',
    },
    'deepseek-v4-pro': {
        label: 'DeepSeek V4 Pro',
        provider: 'openrouter',
        slug: 'deepseek/deepseek-v4-pro',
        byokAlias: 'openrouter',
    },
    'gpt-5-4': {
        label: 'GPT-5.4',
        provider: 'openrouter',
        slug: 'openai/gpt-5.4',
        byokAlias: 'openrouter',
    },
    'gpt-5-4-mini': {
        label: 'GPT-5.4 Mini',
        provider: 'openrouter',
        slug: 'openai/gpt-5.4-mini',
        byokAlias: 'openrouter',
    },
    'kimi-k2-7': {
        label: 'Kimi K2.6',
        provider: 'openrouter',
        slug: 'moonshotai/kimi-k2.6',
        byokAlias: 'openrouter',
    },
    'glm-5-1': {
        label: 'GLM-5.1',
        provider: 'openrouter',
        slug: 'z-ai/glm-5.1',
        byokAlias: 'openrouter',
    },
} as const satisfies Record<string, AiModelDefinition>;

export type AiModelId = keyof typeof AI_MODELS;

export const AI_MODEL_IDS = Object.keys(AI_MODELS) as [AiModelId, ...Array<AiModelId>];

export const DEFAULT_AI_MODEL_ID: AiModelId = 'claude-sonnet-4-6';

export function resolveModelId(modelId: string | null | undefined): AiModelId {
    return modelId && modelId in AI_MODELS ? (modelId as AiModelId) : DEFAULT_AI_MODEL_ID;
}
