import { z } from 'zod';
import { ToolDefinition, ToolContext } from './types.js';

/**
 * 跟踪对象分配工具定义
 */
export const trackAllocationsTool: ToolDefinition = {
    name: 'track_allocations',
    description: '跟踪对象分配',
    inputSchema: z.object({
        url: z.string().optional().describe('页面 URL（可选）'),
        duration: z.number().optional().default(5000).describe('跟踪时长（毫秒），默认 5000'),
    }),
    handler: async (
        args: { url?: string; duration?: number },
        context: ToolContext
    ) => {
        const tracking = await context.heapHandler.trackAllocations({
            url: args.url,
            duration: args.duration,
        });

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(tracking, null, 2),
                },
            ],
        };
    },
};

