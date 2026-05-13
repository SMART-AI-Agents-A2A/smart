import { z, type ZodType } from 'zod';
import { McpError, mcpErrorCodes } from './mcp.errors';
import type { McpTool, McpToolCallResult } from './mcp.schemas';

export interface McpToolContext {
    readonly env: unknown;
}

export interface McpToolDefinition<TInput> {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: ZodType<TInput>;
    readonly jsonSchema: Record<string, unknown>;
    readonly annotations?: Record<string, unknown>;
    readonly handler: (input: TInput, context: McpToolContext) => Promise<McpToolCallResult>;
}

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
                parsed.error.issues.map((issue) => ({
                    path: issue.path.map(String).join('.') || 'root',
                    message: issue.message,
                })),
            );
        }

        return mcpToolCallResultSchema.parse(await tool.handler(parsed.data, context));
    }
}

const mcpToolCallResultSchema = z.object({
    content: z.array(
        z.discriminatedUnion('type', [
            z.object({
                type: z.literal('text'),
                text: z.string(),
            }),
            z.object({
                type: z.literal('json'),
                data: z.unknown(),
            }),
        ]),
    ),
    structuredContent: z.unknown().optional(),
    isError: z.boolean().optional(),
});
