import { z } from 'zod';
import { ToolDefinition, ToolContext } from './types.js';

/**
 * 获取堆快照工具定义
 */
export const getHeapSnapshotTool: ToolDefinition = {
    name: 'get_heap_snapshot',
    description: '获取堆快照',
    inputSchema: z.object({
        url: z.string().optional().describe('页面 URL（可选）'),
    }),
    handler: async (args: { url?: string }, context: ToolContext) => {
        const snapshot = await context.heapHandler.getHeapSnapshot({
            url: args.url,
        });

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(snapshot, null, 2),
                },
            ],
        };
    },
};

