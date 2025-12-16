import { z } from 'zod';
import { ToolDefinition, ToolContext } from './types.js';

/**
 * 获取性能数据工具定义
 */
export const getPerformanceTool: ToolDefinition = {
    name: 'get_performance',
    description: '获取性能数据（Performance Timeline、页面加载指标）',
    inputSchema: z.object({
        url: z.string().optional().describe('页面 URL（可选）'),
    }),
    handler: async (args: { url?: string }, context: ToolContext) => {
        const performance = await context.performanceHandler.getPerformance({
            url: args.url,
        });

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(performance, null, 2),
                },
            ],
        };
    },
};

