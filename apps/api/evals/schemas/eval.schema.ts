import { z } from 'zod';
import { AI_MODEL_IDS } from '../../src/features/ai/ai.models.ts';

const idSchema = z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-_.]*$/);
const nonEmptyStringArraySchema = z.array(z.string().min(1));
const defaultExpected = {
    agents: [],
    tools: [],
};
const defaultRagasCase = { referenceContexts: [] };
const defaultPromptSlot = { mode: 'baseline' } as const;
const defaultPrompts = {
    router: defaultPromptSlot,
    final: defaultPromptSlot,
};

export const evalAgentIdSchema = z.enum([
    'ar',
    'chuva',
    'eletricidade',
    'radiacao',
    'raio',
    'solo',
    'vento',
]);

export const evalRouteSchema = z.enum(['direct', 'agent', 'multi-agent']);

export const evalExpectedSchema = z.object({
    route: evalRouteSchema.optional(),
    agents: z.array(evalAgentIdSchema).default([]),
    tools: nonEmptyStringArraySchema.default([]),
    minRagContexts: z.number().int().min(0).optional(),
});

export const evalRagasCaseSchema = z.object({
    referenceContexts: nonEmptyStringArraySchema.default([]),
    groundTruth: z.string().min(1).optional(),
});

export const evalCaseSchema = z.object({
    id: idSchema,
    category: z.string().min(1),
    userInput: z.string().min(1),
    reference: z.string().min(1),
    tags: nonEmptyStringArraySchema.default([]),
    expected: evalExpectedSchema.default(defaultExpected),
    ragas: evalRagasCaseSchema.default(defaultRagasCase),
    sourceMetadata: z.record(z.string(), z.unknown()).default({}),
    notes: nonEmptyStringArraySchema.default([]),
});

export const evalCaseSetSchema = z.object({
    id: idSchema,
    version: z.number().int().min(1),
    description: z.string().min(1),
    locale: z.string().min(2).default('pt-BR'),
    cases: z.array(evalCaseSchema).min(1),
});

export const legacyDbCaseSchema = z.object({
    numero: z.number().int().positive(),
    pergunta: z.string().min(1),
    resposta: z.string().min(1).optional(),
    motivo_tecnico_da_recomendacao: z.string().min(1).optional(),
    origem_tecnica_da_recomendacao: z.string().min(1).optional(),
    resposta_completa: z.string().min(1).optional(),
    expected_tools: z.array(z.string().min(1)).default([]),
    selection_score: z.number().min(0).max(1).optional(),
    selection_route: z.string().min(1).optional(),
    selection_agents_called: z.array(z.string().min(1)).default([]),
    selection_tools_called: z.array(z.string().min(1)).default([]),
});

export const legacyDbCasesSchema = z.array(legacyDbCaseSchema).min(1);

const baselinePromptSlotSchema = z.object({
    mode: z.literal('baseline'),
});

const promptContentSlotSchema = z.object({
    mode: z.enum(['replace', 'prepend', 'append']),
    content: z.string().min(1),
    separator: z.string().default('\n\n'),
});

export const promptSlotSchema = z.discriminatedUnion('mode', [
    baselinePromptSlotSchema,
    promptContentSlotSchema,
]);

export const promptVariantSchema = z.object({
    id: idSchema,
    version: z.number().int().min(1),
    description: z.string().min(1),
    strategy: z.string().min(1),
    tags: nonEmptyStringArraySchema.default([]),
    prompts: z
        .object({
            router: promptSlotSchema.default(defaultPromptSlot),
            final: promptSlotSchema.default(defaultPromptSlot),
        })
        .default(defaultPrompts),
    notes: nonEmptyStringArraySchema.default([]),
});

export const evalRunConfigSchema = z.object({
    id: idSchema,
    description: z.string().min(1).optional(),
    casesPath: z.string().min(1),
    variantsPath: z.string().min(1),
    output: z.object({
        directory: z.string().min(1),
    }),
    execution: z.object({
        model: z.enum(AI_MODEL_IDS).optional(),
        concurrency: z.number().int().min(1).max(4).default(1),
        timeoutMs: z.number().int().positive().default(180_000),
        resume: z.boolean().default(true),
        maxCases: z.number().int().positive().optional(),
        maxVariants: z.number().int().positive().optional(),
    }),
});

export type EvalCaseSet = z.infer<typeof evalCaseSetSchema>;
export type EvalCase = z.infer<typeof evalCaseSchema>;
export type LegacyDbCase = z.infer<typeof legacyDbCaseSchema>;
export type PromptVariant = z.infer<typeof promptVariantSchema>;
export type EvalRunConfig = z.infer<typeof evalRunConfigSchema>;
