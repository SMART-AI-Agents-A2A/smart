import type { ZodType } from 'zod';
import { zodIssuesToValidationIssues } from '../../../core/validators';
import { McpError, mcpErrorCodes } from './mcp.errors';
import type { McpTool, McpToolCallResult, McpToolJsonSchema } from './mcp.type';
import { mcpToolCallResultSchema } from './mcp.vo';

export interface McpToolContext {
    readonly env: unknown;
}

export interface McpToolDefinition<TInput> {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: ZodType<TInput>;
    readonly jsonSchema: McpToolJsonSchema;
    readonly annotations?: Record<string, unknown>;
    readonly handler: (input: TInput, context: McpToolContext) => Promise<McpToolCallResult>;
}

export type McpToolRegistrar = (registry: McpToolRegistry) => void;

export class McpToolRegistry {
    private readonly tools = new Map<string, McpToolDefinition<unknown>>();

    register<TInput>(tool: McpToolDefinition<TInput>): void {
        if (this.tools.has(tool.name)) {
            throw new McpError(mcpErrorCodes.invalidRequest, `Tool MCP duplicada: ${tool.name}.`);
        }

        this.tools.set(tool.name, tool as McpToolDefinition<unknown>);
    }

    listTools(): readonly McpTool[] {
        return [...this.tools.values()].map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.jsonSchema,
            annotations: tool.annotations ?? {},
        }));
    }

    async callTool(
        name: string,
        rawArguments: Record<string, unknown>,
        context: McpToolContext,
    ): Promise<McpToolCallResult> {
        const tool = this.tools.get(name);

        if (!tool) {
            throw new McpError(mcpErrorCodes.invalidParams, `Tool MCP não encontrada: ${name}.`);
        }

        const parsed = tool.inputSchema.safeParse(rawArguments);

        if (!parsed.success) {
            throw new McpError(
                mcpErrorCodes.invalidParams,
                `Argumentos inválidos para a tool MCP: ${name}.`,
                zodIssuesToValidationIssues(parsed.error),
            );
        }

        return mcpToolCallResultSchema.parse(await tool.handler(parsed.data, context));
    }
}

export const createMcpToolRegistry = (
    registrars: readonly McpToolRegistrar[] = [],
): McpToolRegistry => {
    const registry = new McpToolRegistry();

    for (const registerTools of registrars) {
        registerTools(registry);
    }

    return registry;
};
