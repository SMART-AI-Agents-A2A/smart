import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { exportRagasJsonl } from './run.ts';

type ExportRagasCliOptions = {
    readonly inputPath: string;
    readonly outputPath: string;
};

function toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function resolveCliPath(value: string) {
    if (path.isAbsolute(value)) {
        return value;
    }

    const cwd = process.cwd();
    const workspaceRoot =
        path.basename(cwd) === 'api' && path.basename(path.dirname(cwd)) === 'apps'
            ? path.dirname(path.dirname(cwd))
            : cwd;

    return value.startsWith('apps/')
        ? path.resolve(workspaceRoot, value)
        : path.resolve(cwd, value);
}

function parseCliArgs(args: Array<string>): ExportRagasCliOptions {
    const options: { inputPath?: string; outputPath?: string } = {};

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        const next = args[index + 1];

        if (arg === '--') {
            continue;
        }

        switch (arg) {
            case '--input':
                if (!next) throw new Error('--input requer um caminho.');
                options.inputPath = next;
                index += 1;
                break;
            case '--output':
                if (!next) throw new Error('--output requer um caminho.');
                options.outputPath = next;
                index += 1;
                break;
            default:
                throw new Error(`Argumento desconhecido: ${arg}`);
        }
    }

    if (!options.inputPath) {
        throw new Error('--input e obrigatorio.');
    }
    if (!options.outputPath) {
        throw new Error('--output e obrigatorio.');
    }

    return { inputPath: options.inputPath, outputPath: options.outputPath };
}

export async function runRagasExport(cliArgs = process.argv.slice(2)) {
    const options = parseCliArgs(cliArgs);
    const inputPath = resolveCliPath(options.inputPath);
    const outputPath = resolveCliPath(options.outputPath);
    const ragasExport = await exportRagasJsonl({
        inputPath,
        outputPath,
    });

    console.log(`[ragas] input=${inputPath}`);
    console.log(
        `[ragas] output=${outputPath} rows=${ragasExport.rows} skipped=${ragasExport.skipped}`,
    );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    runRagasExport().catch((error: unknown) => {
        console.error(toErrorMessage(error));
        process.exitCode = 1;
    });
}
