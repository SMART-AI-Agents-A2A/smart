import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
    AI_MODELS,
    DEFAULT_AI_MODEL_ID,
    resolveModelId,
    type AiModelId,
} from '../src/features/ai/ai.models.ts';
import { DEFAULT_AI_PROMPT_PACK, type AiPromptPack } from '../src/features/ai/ai.prompts.ts';
import type {
    AgentExecutionResult,
    AiChatInbound,
    OrchestratorDecision,
    OrchestratorTrace,
    RagContext,
} from '../src/features/ai/ai.type.ts';
import {
    logEvalFooter,
    logEvalItemResult,
    logEvalItemStart,
    logEvalPlan,
    logEvalResume,
    logEvalStopped,
    logRagasExport,
    logVariantStart,
    logVariantSummary,
    type EvalConsolePlanVariant,
    type EvalConsoleVariantSummary,
} from './run.console.ts';
import {
    evalCaseSetSchema,
    evalRunConfigSchema,
    legacyDbCasesSchema,
    promptVariantSchema,
    type EvalCase,
    type EvalCaseSet,
    type EvalRunConfig,
    type LegacyDbCase,
    type PromptVariant,
} from './schemas/eval.schema.ts';

type CliOptions = {
    readonly configPath: string;
    readonly casesPath?: string;
    readonly runId?: string;
    readonly runDir?: string;
    readonly outputDir?: string;
    readonly resume?: string;
    readonly resumePath?: string;
    readonly noResume: boolean;
    readonly dryRun: boolean;
    readonly maxCases?: number;
    readonly maxVariants?: number;
    readonly caseId?: string;
    readonly caseIds?: Array<string>;
    readonly fromCase?: string;
    readonly variantId?: string;
    readonly variantIds?: Array<string>;
    readonly fromVariant?: string;
    readonly model?: string;
    readonly strictModel: boolean;
    readonly variantMode?: 'baseline' | 'append' | 'prepend' | 'replace';
    readonly exportRagas: boolean;
    readonly ragasOutput?: string;
};

type EvalPlanItem = {
    readonly caseItem: EvalCase;
    readonly variant: PromptVariant;
};

type EvalPaths = {
    readonly workspaceRoot: string;
    readonly apiRoot: string;
    readonly runDir: string;
    readonly resultsPath: string;
    readonly resultsJsonPath: string;
    readonly manifestPath: string;
    readonly ragasJsonlPath: string;
};

export type RagasJsonlRow = {
    readonly user_input: string;
    readonly response: string;
    readonly retrieved_contexts: Array<string>;
    readonly reference: string;
    readonly reference_contexts: Array<string>;
    readonly case_id: string;
    readonly variant_id: string;
    readonly strategy: string;
    readonly route: string;
    readonly rag_count: number;
    readonly model: string;
    readonly duration_ms: number;
    readonly run_id: string;
};

type PlatformProxy = {
    readonly env: CloudflareBindings;
    readonly dispose?: () => void | Promise<void>;
};

type PlatformProxyModule = {
    readonly getPlatformProxy?: (options: {
        readonly configPath: string;
        readonly environment: string;
        readonly experimental?: { readonly remoteBindings?: boolean };
    }) => Promise<PlatformProxy>;
};

type EvalResultStatus = 'success' | 'error' | 'skipped';

type EvalRunResult = {
    readonly runId: string;
    readonly caseSetId: string;
    readonly caseId: string;
    readonly variantId: string;
    readonly resultKey: string;
    readonly status: EvalResultStatus;
    readonly dryRun: boolean;
    readonly startedAt: string;
    readonly finishedAt: string;
    readonly durationMs: number;
    readonly model: AiModelId;
    readonly modelSelection: {
        readonly requestedModelId: AiModelId;
        readonly requestedProvider: string;
        readonly requestedSlug: string;
        readonly actualModel: string | null;
        readonly usedFallback: boolean;
    };
    readonly input: {
        readonly userInput: string;
        readonly reference: string;
        readonly category: string;
        readonly tags: Array<string>;
        readonly expected: EvalCase['expected'];
        readonly ragas: EvalCase['ragas'];
        readonly sourceMetadata: EvalCase['sourceMetadata'];
    };
    readonly variant: {
        readonly id: string;
        readonly version: number;
        readonly strategy: string;
        readonly tags: Array<string>;
    };
    readonly orchestration: {
        readonly route: OrchestratorDecision['route'] | null;
        readonly selectedAgent: OrchestratorDecision['selectedAgent'] | null;
        readonly calledAgents: Array<string>;
        readonly calledTools: Array<string>;
        readonly ragSources: RagContext['sources'];
        readonly retrievedContexts: Array<string>;
        readonly trace: OrchestratorTrace | null;
        readonly agentResults: Array<AgentExecutionResult>;
    };
    readonly response: string | null;
    readonly error?: {
        readonly message: string;
    };
};

type TurnResult = {
    readonly response: string;
    readonly actualModel: string;
    readonly decision: OrchestratorDecision;
    readonly trace: OrchestratorTrace;
    readonly agentResults: Array<AgentExecutionResult>;
    readonly ragContext: RagContext;
};

type RagContextWithRetrievedContexts = RagContext & {
    readonly retrievedContexts?: Array<string>;
};

const defaultConfigPath = 'apps/api/evals/run-config.sample.json';

class GracefulEvalStopError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GracefulEvalStopError';
    }
}

function nowIso() {
    return new Date().toISOString();
}

function createRunId() {
    return nowIso().replace(/[:.]/g, '-');
}

function toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function parsePositiveInteger(value: string, flagName: string) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${flagName} deve ser um inteiro positivo.`);
    }

    return parsed;
}

function parseCsv(value: string) {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

export function parseCliArgs(args: Array<string>): CliOptions {
    const options: {
        configPath: string;
        casesPath?: string;
        runId?: string;
        runDir?: string;
        outputDir?: string;
        resume?: string;
        resumePath?: string;
        noResume: boolean;
        dryRun: boolean;
        maxCases?: number;
        maxVariants?: number;
        caseId?: string;
        caseIds?: Array<string>;
        fromCase?: string;
        variantId?: string;
        variantIds?: Array<string>;
        fromVariant?: string;
        model?: string;
        strictModel: boolean;
        variantMode?: 'baseline' | 'append' | 'prepend' | 'replace';
        exportRagas: boolean;
        ragasOutput?: string;
    } = {
        configPath: defaultConfigPath,
        noResume: false,
        dryRun: false,
        strictModel: false,
        exportRagas: false,
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        const next = args[index + 1];

        if (arg === '--') {
            continue;
        }

        switch (arg) {
            case '--config':
                if (!next) throw new Error('--config requer um caminho.');
                options.configPath = next;
                index += 1;
                break;
            case '--cases-path':
                if (!next) throw new Error('--cases-path requer um caminho.');
                options.casesPath = next;
                index += 1;
                break;
            case '--run-id':
                if (!next) throw new Error('--run-id requer um valor.');
                options.runId = next;
                index += 1;
                break;
            case '--run-dir':
                if (!next) throw new Error('--run-dir requer um caminho.');
                options.runDir = next;
                index += 1;
                break;
            case '--output-dir':
                if (!next) throw new Error('--output-dir requer um caminho.');
                options.outputDir = next;
                index += 1;
                break;
            case '--resume':
                if (!next) throw new Error('--resume requer um runId.');
                options.resume = next;
                index += 1;
                break;
            case '--resume-path':
                if (!next) throw new Error('--resume-path requer um caminho.');
                options.resumePath = next;
                index += 1;
                break;
            case '--no-resume':
                options.noResume = true;
                break;
            case '--max-cases':
                if (!next) throw new Error('--max-cases requer um numero.');
                options.maxCases = parsePositiveInteger(next, '--max-cases');
                index += 1;
                break;
            case '--max-variants':
                if (!next) throw new Error('--max-variants requer um numero.');
                options.maxVariants = parsePositiveInteger(next, '--max-variants');
                index += 1;
                break;
            case '--case':
                if (!next) throw new Error('--case requer um id de case.');
                options.caseId = next;
                index += 1;
                break;
            case '--cases':
                if (!next) throw new Error('--cases requer uma lista separada por virgula.');
                options.caseIds = parseCsv(next);
                index += 1;
                break;
            case '--from-case':
                if (!next) throw new Error('--from-case requer um id de case.');
                options.fromCase = next;
                index += 1;
                break;
            case '--variant':
                if (!next) throw new Error('--variant requer um id de variante.');
                options.variantId = next;
                index += 1;
                break;
            case '--variants':
                if (!next) throw new Error('--variants requer uma lista separada por virgula.');
                options.variantIds = parseCsv(next);
                index += 1;
                break;
            case '--from-variant':
                if (!next) throw new Error('--from-variant requer um id de variante.');
                options.fromVariant = next;
                index += 1;
                break;
            case '--model':
                if (!next) throw new Error('--model requer um id de modelo.');
                options.model = next;
                index += 1;
                break;
            case '--variant-mode':
                if (!next) throw new Error('--variant-mode requer um valor.');
                if (!['baseline', 'append', 'prepend', 'replace'].includes(next)) {
                    throw new Error(
                        '--variant-mode deve ser baseline, append, prepend ou replace.',
                    );
                }
                options.variantMode = next as CliOptions['variantMode'];
                index += 1;
                break;
            case '--strict-model':
                options.strictModel = true;
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            case '--export-ragas':
                options.exportRagas = true;
                break;
            case '--ragas-output':
                if (!next) throw new Error('--ragas-output requer um caminho.');
                options.ragasOutput = next;
                index += 1;
                break;
            default:
                throw new Error(`Argumento desconhecido: ${arg}`);
        }
    }

    return options;
}

function resolveConfiguredModel(modelId: string | null | undefined): AiModelId {
    if (!modelId) {
        return DEFAULT_AI_MODEL_ID;
    }

    if (modelId in AI_MODELS) {
        return modelId as AiModelId;
    }

    throw new Error(
        `Modelo invalido: ${modelId}. Modelos validos: ${Object.keys(AI_MODELS).join(', ')}`,
    );
}

async function readJson(pathName: string) {
    const content = await readFile(pathName, 'utf8');

    return JSON.parse(content) as unknown;
}

function normalizeAgentLabel(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function toEvalAgentId(value: string): EvalCase['expected']['agents'][number] | null {
    switch (normalizeAgentLabel(value)) {
        case 'ar':
            return 'ar';
        case 'chuva':
            return 'chuva';
        case 'eletricidade':
            return 'eletricidade';
        case 'radiacao':
            return 'radiacao';
        case 'raio':
        case 'raios':
            return 'raio';
        case 'solo':
            return 'solo';
        case 'vento':
            return 'vento';
        default:
            return null;
    }
}

function toEvalRoute(value: string | undefined): EvalCase['expected']['route'] {
    if (value === 'direct' || value === 'agent' || value === 'multi-agent') {
        return value;
    }

    return undefined;
}

function slugifyCaseId(value: number) {
    return `db-${String(value)}`;
}

function convertLegacyDbCase(caseItem: LegacyDbCase): EvalCase {
    const reference = caseItem.resposta_completa ?? caseItem.resposta ?? caseItem.pergunta;
    const expectedTools =
        caseItem.expected_tools.length > 0
            ? caseItem.expected_tools
            : caseItem.selection_tools_called;
    const expectedAgents = [
        ...new Set(
            caseItem.selection_agents_called
                .map(toEvalAgentId)
                .filter((agentId): agentId is NonNullable<ReturnType<typeof toEvalAgentId>> =>
                    Boolean(agentId),
                ),
        ),
    ];
    const notes = [
        ...(caseItem.motivo_tecnico_da_recomendacao
            ? [`Motivo tecnico: ${caseItem.motivo_tecnico_da_recomendacao}`]
            : []),
        ...(caseItem.origem_tecnica_da_recomendacao
            ? [`Origem tecnica: ${caseItem.origem_tecnica_da_recomendacao}`]
            : []),
        ...(typeof caseItem.selection_score === 'number'
            ? [`Selection score: ${caseItem.selection_score}`]
            : []),
    ];

    return {
        id: slugifyCaseId(caseItem.numero),
        category: 'db',
        userInput: caseItem.pergunta,
        reference,
        tags: ['imported-db-json'],
        expected: {
            route: toEvalRoute(caseItem.selection_route),
            agents: expectedAgents,
            tools: expectedTools,
        },
        ragas: {
            referenceContexts: [
                ...(caseItem.motivo_tecnico_da_recomendacao
                    ? [`Motivo tecnico da recomendacao: ${caseItem.motivo_tecnico_da_recomendacao}`]
                    : []),
                ...(caseItem.origem_tecnica_da_recomendacao
                    ? [`Origem tecnica da recomendacao: ${caseItem.origem_tecnica_da_recomendacao}`]
                    : []),
            ],
            groundTruth: reference,
        },
        sourceMetadata: {
            numero_db: caseItem.numero,
            resposta_db: caseItem.resposta ?? null,
            expected_tools_db: caseItem.expected_tools,
            selection_score_db: caseItem.selection_score ?? null,
            selection_route_db: caseItem.selection_route ?? null,
            selection_agents_called_db: caseItem.selection_agents_called,
            selection_tools_called_db: caseItem.selection_tools_called,
        },
        notes,
    };
}

function convertLegacyDbCases(rawCases: Array<LegacyDbCase>, sourcePath: string): EvalCaseSet {
    return {
        id:
            path
                .basename(sourcePath, path.extname(sourcePath))
                .replace(/[^a-zA-Z0-9-_]/g, '-')
                .toLowerCase() || 'imported-db',
        version: 1,
        description: `Importado de ${sourcePath}`,
        locale: 'pt-BR',
        cases: rawCases.map(convertLegacyDbCase),
    };
}

function parseCaseSetInput(rawInput: unknown, sourcePath: string): EvalCaseSet {
    const nativeCaseSet = evalCaseSetSchema.safeParse(rawInput);
    if (nativeCaseSet.success) {
        return nativeCaseSet.data;
    }

    const legacyCaseSet = legacyDbCasesSchema.safeParse(rawInput);
    if (legacyCaseSet.success) {
        return convertLegacyDbCases(legacyCaseSet.data, sourcePath);
    }

    throw new Error(
        `Arquivo de casos invalido: ${sourcePath}. Esperado EvalCaseSet ou array no formato legacy db.json.`,
    );
}

async function findWorkspaceRoot(startDir: string) {
    let current = path.resolve(startDir);

    while (true) {
        try {
            const packageJson = JSON.parse(
                await readFile(path.join(current, 'package.json'), 'utf8'),
            ) as { readonly name?: string };

            if (packageJson.name === 'smart') {
                return current;
            }
        } catch {
            // Keep walking up until the filesystem root.
        }

        const parent = path.dirname(current);
        if (parent === current) {
            return path.resolve(startDir);
        }
        current = parent;
    }
}

function resolveWorkspacePath(workspaceRoot: string, value: string) {
    return path.isAbsolute(value) ? value : path.resolve(workspaceRoot, value);
}

async function loadPromptVariants(variantsPath: string) {
    const fileNames = (await readdir(variantsPath))
        .filter((fileName) => fileName.endsWith('.json'))
        .sort((left, right) => left.localeCompare(right));

    return Promise.all(
        fileNames.map(async (fileName) =>
            promptVariantSchema.parse(await readJson(path.join(variantsPath, fileName))),
        ),
    );
}

function applyPromptSlot(basePrompt: string, slot: PromptVariant['prompts']['router']) {
    if (slot.mode === 'baseline') {
        return basePrompt;
    }

    if (slot.mode === 'replace') {
        return slot.content;
    }

    if (slot.mode === 'prepend') {
        return [slot.content, basePrompt].join(slot.separator);
    }

    return [basePrompt, slot.content].join(slot.separator);
}

export function composePromptPack(variant: PromptVariant): AiPromptPack {
    return {
        routerPrompt: applyPromptSlot(DEFAULT_AI_PROMPT_PACK.routerPrompt, variant.prompts.router),
        finalPrompt: applyPromptSlot(DEFAULT_AI_PROMPT_PACK.finalPrompt, variant.prompts.final),
    };
}

function variantUsesMode(variant: PromptVariant, mode: NonNullable<CliOptions['variantMode']>) {
    return variant.prompts.router.mode === mode || variant.prompts.final.mode === mode;
}

function filterFromId<TItem extends { readonly id: string }>(
    items: Array<TItem>,
    id: string,
    flagName: string,
) {
    const startIndex = items.findIndex((item) => item.id === id);
    if (startIndex === -1) {
        throw new Error(
            `${flagName} invalido: ${id}. IDs validos: ${items.map((item) => item.id).join(', ')}`,
        );
    }

    return items.slice(startIndex);
}

function filterByIds<TItem extends { readonly id: string }>(
    items: Array<TItem>,
    ids: Array<string>,
    flagName: string,
) {
    const selectedIds = new Set(ids);
    const missingIds = ids.filter((id) => !items.some((item) => item.id === id));

    if (missingIds.length > 0) {
        throw new Error(
            `${flagName} contem IDs invalidos: ${missingIds.join(', ')}. IDs validos: ${items.map((item) => item.id).join(', ')}`,
        );
    }

    return items.filter((item) => selectedIds.has(item.id));
}

export function createEvalPlan(
    caseSet: EvalCaseSet,
    variants: Array<PromptVariant>,
    options: Pick<
        CliOptions,
        | 'maxCases'
        | 'maxVariants'
        | 'variantMode'
        | 'caseId'
        | 'caseIds'
        | 'fromCase'
        | 'variantId'
        | 'variantIds'
        | 'fromVariant'
    >,
    config: EvalRunConfig,
): Array<EvalPlanItem> {
    const caseIds = options.caseId ? [options.caseId] : options.caseIds;
    const variantIds = options.variantId ? [options.variantId] : options.variantIds;
    let filteredCases = caseSet.cases;
    let filteredVariants = variants;

    if (caseIds?.length) {
        filteredCases = filterByIds(filteredCases, caseIds, '--case/--cases');
    }
    if (options.fromCase) {
        filteredCases = filterFromId(filteredCases, options.fromCase, '--from-case');
    }
    if (variantIds?.length) {
        filteredVariants = filterByIds(filteredVariants, variantIds, '--variant/--variants');
    }
    if (options.fromVariant) {
        filteredVariants = filterFromId(filteredVariants, options.fromVariant, '--from-variant');
    }

    const maxCases = options.maxCases ?? config.execution.maxCases ?? filteredCases.length;
    const variantMode = options.variantMode;
    filteredVariants = variantMode
        ? filteredVariants.filter((variant) => variantUsesMode(variant, variantMode))
        : filteredVariants;
    const maxVariants =
        options.maxVariants ?? config.execution.maxVariants ?? filteredVariants.length;
    const selectedCases = filteredCases.slice(0, maxCases);
    const selectedVariants = filteredVariants.slice(0, maxVariants);

    return selectedVariants.flatMap((variant) =>
        selectedCases.map((caseItem) => ({ caseItem, variant })),
    );
}

export function createResultKey(caseId: string, variantId: string) {
    return `${caseId}::${variantId}`;
}

function getRetrievedContexts(ragContext: RagContext): Array<string> {
    const context = ragContext as RagContextWithRetrievedContexts;

    if (context.retrievedContexts?.length) {
        return context.retrievedContexts;
    }

    return context.contextMessage ? [context.contextMessage] : [];
}

function getCalledTools(agentResults: Array<AgentExecutionResult>) {
    return [
        ...new Set(
            agentResults.flatMap((result) => result.evidence?.mcpTools ?? []).filter(Boolean),
        ),
    ].sort((left, right) => left.localeCompare(right));
}

function getCalledAgents(agentResults: Array<AgentExecutionResult>) {
    return [...new Set(agentResults.map((result) => result.agentId))].sort((left, right) =>
        left.localeCompare(right),
    );
}

function getSourceNumero(sourceMetadata: EvalCase['sourceMetadata']) {
    if (typeof sourceMetadata.numero === 'number') {
        return sourceMetadata.numero;
    }
    if (typeof sourceMetadata.numero_db === 'number') {
        return sourceMetadata.numero_db;
    }

    return null;
}

function createVariantPlans(plan: Array<EvalPlanItem>): Array<EvalConsolePlanVariant> {
    const orderedVariantIds = [...new Set(plan.map((item) => item.variant.id))];
    return orderedVariantIds.map((variantId, index) => {
        const firstItem = plan.find((item) => item.variant.id === variantId);
        const total = plan.filter((item) => item.variant.id === variantId).length;
        return {
            id: variantId,
            strategy: firstItem?.variant.strategy ?? 'unknown',
            total,
            index: index + 1,
            totalVariants: orderedVariantIds.length,
        };
    });
}

function createPlanPositionMap(plan: Array<EvalPlanItem>) {
    const positions = new Map<
        string,
        { readonly globalIndex: number; readonly caseIndexInVariant: number }
    >();
    const variantCaseCounts = new Map<string, number>();

    for (const [index, item] of plan.entries()) {
        const caseIndexInVariant = (variantCaseCounts.get(item.variant.id) ?? 0) + 1;
        variantCaseCounts.set(item.variant.id, caseIndexInVariant);
        positions.set(createResultKey(item.caseItem.id, item.variant.id), {
            globalIndex: index + 1,
            caseIndexInVariant,
        });
    }

    return positions;
}

function uniqueCaseIds(plan: Array<EvalPlanItem>) {
    return [...new Set(plan.map((item) => item.caseItem.id))];
}

function createPayload(caseItem: EvalCase, model: AiModelId): AiChatInbound {
    return {
        model,
        conversationId: `eval-${caseItem.id}`,
        messages: [{ role: 'user', content: caseItem.userInput }],
    };
}

async function collectModelResponse(stream: ReadableStream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let response = '';
    let buffer = '';
    let finished = false;

    const { processUpstreamBlock } = await import('../src/features/ai/ai.orchestrate.ts');

    try {
        while (!finished) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            while (true) {
                const boundary = buffer.indexOf('\n\n');
                if (boundary === -1) break;

                const block = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                const isDone = processUpstreamBlock(block, (delta: string) => {
                    response += delta;
                });

                if (isDone) {
                    finished = true;
                    break;
                }
            }
        }

        buffer += decoder.decode();
        if (!finished && buffer.trim()) {
            processUpstreamBlock(buffer, (delta: string) => {
                response += delta;
            });
        }
    } finally {
        reader.releaseLock();
    }

    return response;
}

async function runRealTurn(
    env: CloudflareBindings,
    payload: AiChatInbound,
    promptPack: AiPromptPack,
    options?: { readonly allowWorkersFallback?: boolean },
): Promise<TurnResult> {
    const {
        buildFinalMessages,
        buildTracePayload,
        executeAgentPlan,
        getRagContext,
        runPrimaryModelStream,
        runRoutingDecision,
    } = await import('../src/features/ai/ai.orchestrate.ts');
    const ragContext = await getRagContext(env, payload);
    const decision = await runRoutingDecision(env, payload, ragContext, promptPack);
    const agentResults = await executeAgentPlan(decision, payload, ragContext, env);
    const trace = buildTracePayload(decision, agentResults, ragContext);
    const baseRagContext: RagContext = { contextMessage: null, sources: [] };
    const finalMessages = buildFinalMessages(
        payload,
        ragContext,
        decision,
        agentResults,
        promptPack,
    );
    const baseMessages = buildFinalMessages(
        payload,
        baseRagContext,
        decision,
        agentResults,
        promptPack,
    );
    const modelId = resolveModelId(payload.model);
    const upstreamSelection = await runPrimaryModelStream(
        env,
        finalMessages,
        baseMessages,
        Boolean(ragContext.contextMessage),
        modelId,
        { allowWorkersFallback: options?.allowWorkersFallback ?? true },
    );
    const response = await collectModelResponse(upstreamSelection.stream);

    return {
        response,
        actualModel: upstreamSelection.model,
        decision,
        trace,
        agentResults,
        ragContext,
    };
}

async function withTimeout<TValue>(promise: Promise<TValue>, timeoutMs: number) {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
            reject(new Error(`Execucao excedeu timeout de ${timeoutMs}ms.`));
        }, timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

function createSkippedDryRunTurn(): TurnResult {
    return {
        response: '',
        actualModel: 'dry-run',
        decision: {
            route: 'direct',
            selectedAgent: null,
            calls: [],
            confidence: 0,
            reason: 'Dry-run: execucao real nao foi iniciada.',
            userGoal: 'Dry-run',
            neededAction: 'dry_run',
        },
        trace: {
            thinking: ['Dry-run: nenhum modelo, RAG ou agente foi chamado.'],
            route: 'direct',
            selectedAgent: null,
            agentCall: {
                called: false,
                agentId: null,
                agentName: null,
                action: null,
                status: 'skipped',
                summary: 'Dry-run sem chamada de agente.',
            },
            references: [],
        },
        agentResults: [],
        ragContext: { contextMessage: null, sources: [] },
    };
}

function isGracefulStopError(error: unknown) {
    return error instanceof GracefulEvalStopError;
}

function isRecoverableProviderStopError(error: unknown) {
    const message = toErrorMessage(error).toLowerCase();

    return [
        'key limit exceeded',
        'daily limit',
        'quota',
        '402',
        'credits',
        'more credits',
        'requires more credits',
        'rate limit',
        '429',
        '403',
        'fallback',
        'caiu para fallback',
        'timeout',
        'excedeu timeout',
    ].some((fragment) => message.includes(fragment));
}

function buildResult(args: {
    readonly runId: string;
    readonly caseSet: EvalCaseSet;
    readonly item: EvalPlanItem;
    readonly status: EvalResultStatus;
    readonly dryRun: boolean;
    readonly startedAt: string;
    readonly finishedAt: string;
    readonly model: AiModelId;
    readonly turn: TurnResult | null;
    readonly error?: unknown;
}): EvalRunResult {
    const durationMs = Date.parse(args.finishedAt) - Date.parse(args.startedAt);
    const { caseItem, variant } = args.item;
    const resultKey = createResultKey(caseItem.id, variant.id);
    const agentResults = args.turn?.agentResults ?? [];
    const ragContext = args.turn?.ragContext ?? { contextMessage: null, sources: [] };
    const requestedModel = AI_MODELS[args.model];
    const actualModel = args.turn?.actualModel ?? null;
    const usedFallback = Boolean(
        actualModel && actualModel !== 'dry-run' && actualModel !== requestedModel.slug,
    );

    return {
        runId: args.runId,
        caseSetId: args.caseSet.id,
        caseId: caseItem.id,
        variantId: variant.id,
        resultKey,
        status: args.status,
        dryRun: args.dryRun,
        startedAt: args.startedAt,
        finishedAt: args.finishedAt,
        durationMs,
        model: args.model,
        modelSelection: {
            requestedModelId: args.model,
            requestedProvider: requestedModel.provider,
            requestedSlug: requestedModel.slug,
            actualModel,
            usedFallback,
        },
        input: {
            userInput: caseItem.userInput,
            reference: caseItem.reference,
            category: caseItem.category,
            tags: caseItem.tags,
            expected: caseItem.expected,
            ragas: caseItem.ragas,
            sourceMetadata: caseItem.sourceMetadata,
        },
        variant: {
            id: variant.id,
            version: variant.version,
            strategy: variant.strategy,
            tags: variant.tags,
        },
        orchestration: {
            route: args.turn?.decision.route ?? null,
            selectedAgent: args.turn?.decision.selectedAgent ?? null,
            calledAgents: getCalledAgents(agentResults),
            calledTools: getCalledTools(agentResults),
            ragSources: ragContext.sources,
            retrievedContexts: getRetrievedContexts(ragContext),
            trace: args.turn?.trace ?? null,
            agentResults,
        },
        response: args.turn?.response ?? null,
        ...(args.error ? { error: { message: toErrorMessage(args.error) } } : {}),
    };
}

async function appendJsonLine(pathName: string, value: unknown) {
    await appendFile(pathName, `${JSON.stringify(value)}\n`, 'utf8');
}

export async function readResultsJsonl(resultsPath: string) {
    try {
        const content = await readFile(resultsPath, 'utf8');
        const results: Array<EvalRunResult> = [];

        for (const line of content.split(/\r?\n/)) {
            if (!line.trim()) continue;
            results.push(JSON.parse(line) as EvalRunResult);
        }

        return results;
    } catch {
        return [];
    }
}

async function writeJson(pathName: string, value: unknown) {
    await writeFile(pathName, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function toRagasRow(result: EvalRunResult): RagasJsonlRow {
    return {
        user_input: result.input.userInput,
        response: result.response ?? '',
        retrieved_contexts: result.orchestration.retrievedContexts ?? [],
        reference: result.input.reference ?? '',
        reference_contexts: result.input.ragas.referenceContexts ?? [],
        case_id: result.caseId,
        variant_id: result.variantId,
        strategy: result.variant.strategy,
        route: result.orchestration.route ?? 'n/a',
        rag_count: result.orchestration.retrievedContexts?.length ?? 0,
        model: result.modelSelection.actualModel ?? result.modelSelection.requestedSlug,
        duration_ms: result.durationMs,
        run_id: result.runId,
    };
}

export async function exportRagasJsonl(args: {
    readonly inputPath: string;
    readonly outputPath: string;
}) {
    const results = await readResultsJsonl(args.inputPath);
    const rows = results
        .filter((result) => result.status === 'success')
        .filter((result) => !result.modelSelection.usedFallback)
        .filter((result) => result.orchestration.retrievedContexts.length > 0)
        .map((result) => toRagasRow(result));
    const content = rows.map((row) => JSON.stringify(row)).join('\n');

    await mkdir(path.dirname(args.outputPath), { recursive: true });
    await writeFile(args.outputPath, content ? `${content}\n` : '', 'utf8');

    return { rows: rows.length, skipped: results.length - rows.length };
}

async function loadInputs(options: CliOptions) {
    const workspaceRoot = await findWorkspaceRoot(process.cwd());
    const apiRoot = path.join(workspaceRoot, 'apps/api');
    const configPath = resolveWorkspacePath(workspaceRoot, options.configPath);
    const config = evalRunConfigSchema.parse(await readJson(configPath));
    const casesPath = resolveWorkspacePath(workspaceRoot, options.casesPath ?? config.casesPath);
    const variantsPath = resolveWorkspacePath(workspaceRoot, config.variantsPath);
    const caseSet = parseCaseSetInput(await readJson(casesPath), casesPath);
    const variants = await loadPromptVariants(variantsPath);

    return { workspaceRoot, apiRoot, config, caseSet, variants, casesPath };
}

function createEvalPaths(args: {
    readonly workspaceRoot: string;
    readonly apiRoot: string;
    readonly config: EvalRunConfig;
    readonly options: CliOptions;
    readonly runId: string;
}): EvalPaths {
    const outputDir = args.options.outputDir ?? args.config.output.directory;
    const resolvedOutputDir = resolveWorkspacePath(args.workspaceRoot, outputDir);
    const runDir = args.options.resumePath
        ? resolveWorkspacePath(args.workspaceRoot, args.options.resumePath)
        : args.options.resume
          ? path.join(resolvedOutputDir, args.options.resume)
          : args.options.runDir
            ? resolveWorkspacePath(args.workspaceRoot, args.options.runDir)
            : path.join(resolvedOutputDir, args.runId);
    const ragasJsonlPath = args.options.ragasOutput
        ? resolveWorkspacePath(args.workspaceRoot, args.options.ragasOutput)
        : path.join(runDir, 'ragas.jsonl');

    return {
        workspaceRoot: args.workspaceRoot,
        apiRoot: args.apiRoot,
        runDir,
        resultsPath: path.join(runDir, 'results.jsonl'),
        resultsJsonPath: path.join(runDir, 'results.json'),
        manifestPath: path.join(runDir, 'manifest.json'),
        ragasJsonlPath,
    };
}

function createVariantSummaryMap(plan: Array<EvalPlanItem>) {
    const summaries = new Map<string, EvalConsoleVariantSummary>();
    for (const variantPlan of createVariantPlans(plan)) {
        summaries.set(variantPlan.id, {
            id: variantPlan.id,
            strategy: variantPlan.strategy,
            total: variantPlan.total,
            completed: 0,
            success: 0,
            error: 0,
            skipped: 0,
            totalDurationMs: 0,
        });
    }
    return summaries;
}

async function acquirePlatformProxy(paths: EvalPaths) {
    const wranglerModule = (await import('wrangler')) as PlatformProxyModule;

    if (typeof wranglerModule.getPlatformProxy !== 'function') {
        throw new Error('wrangler.getPlatformProxy nao esta disponivel nesta instalacao.');
    }

    const proxy = await wranglerModule.getPlatformProxy({
        configPath: path.join(paths.apiRoot, 'wrangler.jsonc'),
        environment: 'development',
        experimental: { remoteBindings: true },
    });

    for (const [key, value] of Object.entries(proxy.env)) {
        if (typeof value === 'string' && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }

    return proxy;
}

async function runWithConcurrency<TItem>(
    items: Array<TItem>,
    concurrency: number,
    worker: (item: TItem) => Promise<void>,
) {
    let index = 0;
    let stoppedReason: string | null = null;
    const workers = Array.from({ length: concurrency }, async () => {
        while (true) {
            if (stoppedReason) return;
            const currentIndex = index;
            index += 1;
            const item = items[currentIndex];

            if (!item) return;

            try {
                await worker(item);
            } catch (error) {
                if (isGracefulStopError(error)) {
                    stoppedReason = toErrorMessage(error);
                    return;
                }
                throw error;
            }
        }
    });

    await Promise.all(workers);

    return { stoppedReason };
}

async function executePlan(args: {
    readonly runId: string;
    readonly config: EvalRunConfig;
    readonly caseSet: EvalCaseSet;
    readonly casesPath: string;
    readonly plan: Array<EvalPlanItem>;
    readonly paths: EvalPaths;
    readonly options: CliOptions;
    readonly proxy: PlatformProxy | null;
}) {
    const model = resolveConfiguredModel(args.options.model ?? args.config.execution.model);
    const shouldResume =
        !args.options.noResume &&
        (args.config.execution.resume ||
            Boolean(args.options.resume) ||
            Boolean(args.options.resumePath));
    const existingResults = shouldResume ? await readResultsJsonl(args.paths.resultsPath) : [];
    const existingKeys = new Set(
        existingResults.map(
            (result) => result.resultKey ?? createResultKey(result.caseId, result.variantId),
        ),
    );
    const results: Array<EvalRunResult> = [];
    const pendingPlan = args.plan.filter(
        (item) => !existingKeys.has(createResultKey(item.caseItem.id, item.variant.id)),
    );
    const variantPlans = createVariantPlans(args.plan);
    const planPositionMap = createPlanPositionMap(args.plan);
    const variantSummaryMap = createVariantSummaryMap(args.plan);
    const planKeys = new Set(
        args.plan.map((item) => createResultKey(item.caseItem.id, item.variant.id)),
    );
    for (const result of existingResults) {
        const resultKey = result.resultKey ?? createResultKey(result.caseId, result.variantId);
        if (!planKeys.has(resultKey)) continue;
        const summary = variantSummaryMap.get(result.variantId);
        if (summary) {
            summary.completed += 1;
            summary.success += result.status === 'success' ? 1 : 0;
            summary.error += result.status === 'error' ? 1 : 0;
            summary.skipped += result.status === 'skipped' ? 1 : 0;
            summary.totalDurationMs += result.status === 'skipped' ? 0 : result.durationMs;
        }
    }
    const startedVariants = new Set<string>();

    logEvalPlan({
        runId: args.runId,
        casesPath: args.casesPath,
        model,
        dryRun: args.options.dryRun,
        strictModel: args.options.strictModel,
        sourceCases: args.caseSet.cases.length,
        selectedCases: uniqueCaseIds(args.plan).length,
        totalPlanned: args.plan.length,
        completed: args.plan.length - pendingPlan.length,
        pending: pendingPlan.length,
        variantMode: args.options.variantMode ?? null,
        variants: variantPlans,
    });

    if (shouldResume && existingKeys.size > 0) {
        logEvalResume({
            runId: args.runId,
            runDir: args.paths.runDir,
            completed: args.plan.length - pendingPlan.length,
        });
    }

    await writeJson(args.paths.manifestPath, {
        runId: args.runId,
        createdAt: nowIso(),
        dryRun: args.options.dryRun,
        model,
        strictModel: args.options.strictModel,
        variantMode: args.options.variantMode ?? null,
        requestedModel: AI_MODELS[model],
        concurrency: args.config.execution.concurrency,
        caseSet: {
            id: args.caseSet.id,
            version: args.caseSet.version,
            caseCount: args.caseSet.cases.length,
        },
        variants: args.plan
            .map((item) => item.variant.id)
            .filter((value, index, list) => list.indexOf(value) === index),
        totalPlanned: args.plan.length,
        skippedByResume: args.plan.length - pendingPlan.length,
    });

    const runState = await runWithConcurrency(
        pendingPlan,
        args.options.dryRun ? 1 : args.config.execution.concurrency,
        async (item) => {
            if (!startedVariants.has(item.variant.id)) {
                startedVariants.add(item.variant.id);
                const variantPlan = variantPlans.find((variant) => variant.id === item.variant.id);
                if (variantPlan) {
                    logVariantStart(variantPlan);
                }
            }
            const variantPlan = variantPlans.find((variant) => variant.id === item.variant.id);
            const planPosition = planPositionMap.get(
                createResultKey(item.caseItem.id, item.variant.id),
            );
            const globalIndex = planPosition?.globalIndex ?? 0;
            const caseIndexInVariant = planPosition?.caseIndexInVariant ?? 0;
            logEvalItemStart({
                started: globalIndex,
                total: args.plan.length,
                variantIndex: variantPlan?.index ?? 0,
                totalVariants: variantPlan?.totalVariants ?? variantPlans.length,
                caseIndexInVariant,
                totalCasesInVariant: variantPlan?.total ?? 0,
                caseId: item.caseItem.id,
                numero: getSourceNumero(item.caseItem.sourceMetadata),
                variantId: item.variant.id,
                strategy: item.variant.strategy,
                model,
                question: item.caseItem.userInput,
                remaining: Math.max(0, args.plan.length - globalIndex),
            });
            const startedAt = nowIso();
            const promptPack = composePromptPack(item.variant);

            try {
                const turn = args.options.dryRun
                    ? createSkippedDryRunTurn()
                    : await withTimeout(
                          runRealTurn(
                              args.proxy?.env as CloudflareBindings,
                              createPayload(item.caseItem, model),
                              promptPack,
                              { allowWorkersFallback: !args.options.strictModel },
                          ),
                          args.config.execution.timeoutMs,
                      );
                const requestedModel = AI_MODELS[model];

                if (
                    args.options.strictModel &&
                    !args.options.dryRun &&
                    turn.actualModel !== requestedModel.slug
                ) {
                    throw new Error(
                        `Modelo solicitado ${model} (${requestedModel.slug}) caiu para fallback ${turn.actualModel}.`,
                    );
                }
                const finishedAt = nowIso();
                const result = buildResult({
                    runId: args.runId,
                    caseSet: args.caseSet,
                    item,
                    status: args.options.dryRun ? 'skipped' : 'success',
                    dryRun: args.options.dryRun,
                    startedAt,
                    finishedAt,
                    model,
                    turn,
                });

                results.push(result);
                await appendJsonLine(args.paths.resultsPath, result);
                const summary = variantSummaryMap.get(item.variant.id);
                if (summary) {
                    summary.completed += 1;
                    summary.success += result.status === 'success' ? 1 : 0;
                    summary.error += result.status === 'error' ? 1 : 0;
                    summary.skipped += result.status === 'skipped' ? 1 : 0;
                    summary.totalDurationMs += result.status === 'skipped' ? 0 : result.durationMs;
                }
                logEvalItemResult({
                    completed: globalIndex,
                    total: args.plan.length,
                    variantIndex: variantPlan?.index ?? 0,
                    totalVariants: variantPlan?.totalVariants ?? variantPlans.length,
                    caseIndexInVariant,
                    totalCasesInVariant: variantPlan?.total ?? 0,
                    status: result.status,
                    caseId: result.caseId,
                    numero: getSourceNumero(result.input.sourceMetadata),
                    variantId: result.variantId,
                    route: result.orchestration.route ?? 'n/a',
                    ragCount: result.orchestration.retrievedContexts.length,
                    durationMs: result.durationMs,
                    actualModel: result.modelSelection.actualModel,
                    fallbackModel: result.modelSelection.usedFallback
                        ? result.modelSelection.actualModel
                        : null,
                    remaining: Math.max(0, args.plan.length - globalIndex),
                });
            } catch (error) {
                const finishedAt = nowIso();
                const shouldStop = isRecoverableProviderStopError(error);
                const result = buildResult({
                    runId: args.runId,
                    caseSet: args.caseSet,
                    item,
                    status: 'error',
                    dryRun: args.options.dryRun,
                    startedAt,
                    finishedAt,
                    model,
                    turn: null,
                    error,
                });

                if (!shouldStop) {
                    results.push(result);
                    await appendJsonLine(args.paths.resultsPath, result);
                    const summary = variantSummaryMap.get(item.variant.id);
                    if (summary) {
                        summary.completed += 1;
                        summary.success += result.status === 'success' ? 1 : 0;
                        summary.error += result.status === 'error' ? 1 : 0;
                        summary.skipped += result.status === 'skipped' ? 1 : 0;
                        summary.totalDurationMs +=
                            result.status === 'skipped' ? 0 : result.durationMs;
                    }
                }
                logEvalItemResult({
                    completed: globalIndex,
                    total: args.plan.length,
                    variantIndex: variantPlan?.index ?? 0,
                    totalVariants: variantPlan?.totalVariants ?? variantPlans.length,
                    caseIndexInVariant,
                    totalCasesInVariant: variantPlan?.total ?? 0,
                    status: result.status,
                    caseId: result.caseId,
                    numero: getSourceNumero(result.input.sourceMetadata),
                    variantId: result.variantId,
                    route: result.orchestration.route ?? 'n/a',
                    ragCount: result.orchestration.retrievedContexts.length,
                    durationMs: result.durationMs,
                    actualModel: result.modelSelection.actualModel,
                    fallbackModel: result.modelSelection.usedFallback
                        ? result.modelSelection.actualModel
                        : null,
                    remaining: shouldStop
                        ? Math.max(0, args.plan.length - globalIndex + 1)
                        : Math.max(0, args.plan.length - globalIndex),
                    errorMessage: result.error?.message,
                    question: result.input.userInput,
                });

                if (shouldStop) {
                    throw new GracefulEvalStopError(toErrorMessage(error));
                }
            }
        },
    );

    if (runState.stoppedReason) {
        logEvalStopped(runState.stoppedReason);
    }

    const allResults = await readResultsJsonl(args.paths.resultsPath);
    await writeJson(args.paths.resultsJsonPath, allResults);

    if (args.options.exportRagas) {
        const ragasExport = await exportRagasJsonl({
            inputPath: args.paths.resultsPath,
            outputPath: args.paths.ragasJsonlPath,
        });
        logRagasExport({
            outputPath: args.paths.ragasJsonlPath,
            rows: ragasExport.rows,
            skipped: ragasExport.skipped,
        });
    }

    for (const summary of variantSummaryMap.values()) {
        logVariantSummary(summary);
    }

    return results;
}

export async function runPromptEval(cliArgs = process.argv.slice(2)) {
    const options = parseCliArgs(cliArgs);
    const { workspaceRoot, apiRoot, config, caseSet, variants, casesPath } =
        await loadInputs(options);
    const initialRunId = options.resume ?? options.runId ?? createRunId();
    const initialPaths = createEvalPaths({
        workspaceRoot,
        apiRoot,
        config,
        options,
        runId: initialRunId,
    });
    const manifest = await readJson(initialPaths.manifestPath).catch(() => null);
    const manifestRunId =
        typeof manifest === 'object' &&
        manifest &&
        'runId' in manifest &&
        typeof manifest.runId === 'string'
            ? manifest.runId
            : null;
    const runId = options.resume ?? options.runId ?? manifestRunId ?? initialRunId;
    const paths = createEvalPaths({ workspaceRoot, apiRoot, config, options, runId });
    const plan = createEvalPlan(caseSet, variants, options, config);

    await mkdir(paths.runDir, { recursive: true });

    let proxy: PlatformProxy | null = null;

    try {
        if (!options.dryRun) {
            proxy = await acquirePlatformProxy(paths);
        }

        const results = await executePlan({
            runId,
            config,
            caseSet,
            casesPath,
            plan,
            paths,
            options,
            proxy,
        });

        logEvalFooter({
            runDir: paths.runDir,
            resultsWritten: results.length,
            casesPath,
            resultsJsonPath: paths.resultsJsonPath,
            ragasJsonlPath: options.exportRagas ? paths.ragasJsonlPath : undefined,
        });
    } finally {
        await proxy?.dispose?.();
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    runPromptEval().catch((error: unknown) => {
        console.error(toErrorMessage(error));
        process.exitCode = 1;
    });
}
