import { createMcpServer } from './core';
import { createEnvironmentalMcpRegistry } from './mcp.environmental-tools';

const registry = createEnvironmentalMcpRegistry();

export const mcpRoutes = createMcpServer({ registry });
