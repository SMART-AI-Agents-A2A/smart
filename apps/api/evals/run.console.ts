export type EvalConsolePlanVariant = {
    readonly id: string;
    readonly strategy: string;
    readonly total: number;
    readonly index: number;
    readonly totalVariants: number;
};

export type EvalConsolePlan = {
    readonly runId: string;
    readonly casesPath: string;
    readonly model: string;
    readonly dryRun: boolean;
    readonly strictModel: boolean;
    readonly sourceCases: number;
    readonly selectedCases: number;
    readonly totalPlanned: number;
    readonly completed: number;
    readonly pending: number;
    readonly variantMode: string | null;
    readonly variants: Array<EvalConsolePlanVariant>;
};

export type EvalConsoleItemStart = {
    readonly started: number;
    readonly total: number;
    readonly variantIndex: number;
    readonly totalVariants: number;
    readonly caseIndexInVariant: number;
    readonly totalCasesInVariant: number;
    readonly caseId: string;
    readonly numero: number | null;
    readonly variantId: string;
    readonly strategy: string;
    readonly model: string;
    readonly question: string;
    readonly remaining: number;
};

export type EvalConsoleItemResult = {
    readonly completed: number;
    readonly total: number;
    readonly variantIndex: number;
    readonly totalVariants: number;
    readonly caseIndexInVariant: number;
    readonly totalCasesInVariant: number;
    readonly status: 'success' | 'error' | 'skipped';
    readonly caseId: string;
    readonly numero: number | null;
    readonly variantId: string;
    readonly route: string;
    readonly ragCount: number;
    readonly durationMs: number;
    readonly actualModel: string | null;
    readonly fallbackModel: string | null;
    readonly remaining: number;
    readonly errorMessage?: string;
    readonly question?: string;
};

export type EvalConsoleVariantSummary = {
    readonly id: string;
    readonly strategy: string;
    readonly total: number;
    completed: number;
    success: number;
    error: number;
    skipped: number;
    totalDurationMs: number;
};

const supportsColor = Boolean(process.stdout.isTTY);

function color(code: number, value: string) {
    return supportsColor ? `\u001b[${code}m${value}\u001b[0m` : value;
}

function bold(value: string) {
    return color(1, value);
}

function dim(value: string) {
    return color(2, value);
}

function cyan(value: string) {
    return color(36, value);
}

function green(value: string) {
    return color(32, value);
}

function yellow(value: string) {
    return color(33, value);
}

function red(value: string) {
    return color(31, value);
}

function shortText(value: string, maxChars: number) {
    return value.length <= maxChars ? value : `${value.slice(0, maxChars - 3)}...`;
}

function progressBar(current: number, total: number, width = 24) {
    if (total <= 0) {
        return `[${'-'.repeat(width)}]`;
    }

    const filled = Math.min(width, Math.max(0, Math.round((current / total) * width)));
    return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`;
}

function percent(current: number, total: number) {
    if (total <= 0) {
        return '0.0%';
    }

    return `${((current / total) * 100).toFixed(1)}%`;
}

function variantLabel(variant: EvalConsolePlanVariant | EvalConsoleVariantSummary) {
    return `${variant.id} (${variant.strategy})`;
}

export function logEvalPlan(plan: EvalConsolePlan) {
    const variantLabels = plan.variants.map(variantLabel).join(', ');
    console.log(cyan(`[eval] ${'='.repeat(72)}`));
    console.log(bold(`[eval] runId=${plan.runId}`));
    console.log(`[eval] cases=${plan.casesPath}`);
    console.log(`[eval] model=${plan.model} dryRun=${plan.dryRun} strictModel=${plan.strictModel}`);
    console.log(
        `[eval] sourceCases=${plan.sourceCases} selectedCases=${plan.selectedCases} selectedVariants=${plan.variants.length}`,
    );
    console.log(
        `[eval] totalPlanned=${plan.totalPlanned} completed=${plan.completed} pending=${plan.pending} ${progressBar(plan.completed, plan.totalPlanned)} ${percent(plan.completed, plan.totalPlanned)}`,
    );
    if (plan.variantMode) {
        console.log(`[eval] variantMode=${plan.variantMode}`);
    }
    console.log(`[eval] variants=${variantLabels}`);
    console.log(cyan(`[eval] ${'='.repeat(72)}`));
}

export function logEvalResume(args: {
    readonly runId: string;
    readonly runDir: string;
    readonly completed: number;
}) {
    console.log(
        yellow(`[resume] runId=${args.runId} runDir=${args.runDir} completed=${args.completed}`),
    );
}

export function logEvalStopped(message: string) {
    console.log(yellow(`[eval] stopped=${message}`));
}

export function logRagasExport(args: {
    readonly outputPath: string;
    readonly rows: number;
    readonly skipped: number;
}) {
    console.log(
        green(`[ragas] output=${args.outputPath} rows=${args.rows} skipped=${args.skipped}`),
    );
}

export function logVariantStart(variant: EvalConsolePlanVariant) {
    console.log(
        bold(
            `[variant ${variant.index}/${variant.totalVariants}] start ${variantLabel(variant)} totalCases=${variant.total}`,
        ),
    );
}

export function logEvalItemStart(item: EvalConsoleItemStart) {
    console.log(
        `[variant ${item.variantIndex}/${item.totalVariants}][case ${item.caseIndexInVariant}/${item.totalCasesInVariant}][global ${item.started}/${item.total}] running case=${item.caseId}${item.numero ? ` (#${item.numero})` : ''} variant=${item.variantId} strategy=${item.strategy} model=${item.model} remaining=${item.remaining}`,
    );
    console.log(dim(`  question=${shortText(item.question, 140)}`));
}

export function logEvalItemResult(item: EvalConsoleItemResult) {
    const statusLabel =
        item.status === 'success'
            ? green(item.status)
            : item.status === 'error'
              ? red(item.status)
              : yellow(item.status);
    const fallback = item.fallbackModel ? ` fallback=${item.fallbackModel}` : '';
    console.log(
        `[variant ${item.variantIndex}/${item.totalVariants}][case ${item.caseIndexInVariant}/${item.totalCasesInVariant}][global ${item.completed}/${item.total}] ${statusLabel} case=${item.caseId}${item.numero ? ` (#${item.numero})` : ''} variant=${item.variantId} route=${item.route} rag=${item.ragCount} remaining=${item.remaining}${fallback}`,
    );
    if (item.status === 'error') {
        if (item.question) {
            console.log(dim(`  question=${shortText(item.question, 140)}`));
        }
        console.log(red(`  error=${item.errorMessage ?? 'erro desconhecido'}`));
        return;
    }

    console.log(
        dim(
            `  actualModel=${item.actualModel ?? 'n/a'} durationMs=${item.durationMs} progress=${percent(item.completed, item.total)}`,
        ),
    );
}

export function logVariantSummary(summary: EvalConsoleVariantSummary) {
    const measuredCount = summary.success + summary.error;
    const avgDurationMs = measuredCount > 0 ? summary.totalDurationMs / measuredCount : 0;
    console.log(
        `[summary] ${variantLabel(summary)} completed=${summary.completed}/${summary.total} success=${summary.success}/${summary.total} (${percent(summary.success, summary.total)}) error=${summary.error} skipped=${summary.skipped} avg=${(avgDurationMs / 1000).toFixed(1)}s`,
    );
}

export function logEvalFooter(args: {
    readonly runDir: string;
    readonly resultsWritten: number;
    readonly casesPath: string;
    readonly resultsJsonPath: string;
    readonly ragasJsonlPath?: string;
}) {
    console.log(cyan(`[eval] ${'-'.repeat(72)}`));
    console.log(`[eval] runDir=${args.runDir}`);
    console.log(`[eval] resultsWritten=${args.resultsWritten}`);
    console.log(`[eval] cases=${args.casesPath}`);
    console.log(`[eval] resultsJson=${args.resultsJsonPath}`);
    if (args.ragasJsonlPath) {
        console.log(`[eval] ragasJsonl=${args.ragasJsonlPath}`);
    }
}
