import { z } from 'zod';
import { ToolDefinition, ToolContext } from './types.js';

/**
 * 分析内存工具定义
 */
export const analyzeMemoryTool: ToolDefinition = {
    name: 'analyze_memory',
    description: '分析内存使用情况',
    inputSchema: z.object({
        url: z.string().optional().describe('页面 URL（可选）'),
    }),
    handler: async (args: { url?: string }, context: ToolContext) => {
        const analysis = await context.heapHandler.analyzeMemory({
            url: args.url,
        });

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(analysis, null, 2),
                },
            ],
        };
    },
};

