import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolDefinition, ToolContext } from './types.js';
import { navigateTool } from './navigate.js';
import { getConsoleErrorsTool } from './get-console-errors.js';
import { checkElementTool } from './check-element.js';
import { getCacheStatusTool } from './get-cache-status.js';
import { getPerformanceTool } from './get-performance.js';
import { getHeapSnapshotTool } from './get-heap-snapshot.js';
import { analyzeMemoryTool } from './analyze-memory.js';
import { trackAllocationsTool } from './track-allocations.js';
import { takeScreenshotTool } from './take-screenshot.js';
import { getLighthouseTool } from './get-lighthouse.js';

/**
 * 所有工具定义列表
 */
export const allTools: ToolDefinition[] = [
  navigateTool,
  getConsoleErrorsTool,
  checkElementTool,
  getCacheStatusTool,
  getPerformanceTool,
  getHeapSnapshotTool,
  analyzeMemoryTool,
  trackAllocationsTool,
  takeScreenshotTool,
  getLighthouseTool,
];

/**
 * 注册所有工具到 MCP Server
 */
export function registerAllTools(server: McpServer, context: ToolContext): void {
  for (const tool of allTools) {
    const handler = async (args: any) => {
      return tool.handler(args, context);
    };

    (server.registerTool as any)(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      handler
    );
  }
}

