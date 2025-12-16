import { z } from 'zod';
import { ToolDefinition, ToolContext } from './types.js';

/**
 * 导航工具定义
 */
export const navigateTool: ToolDefinition = {
    name: 'navigate',
    description: '导航到指定 URL',
    inputSchema: z.object({
        url: z.string().describe('要导航到的 URL'),
    }),
    handler: async (args: { url: string }, context: ToolContext) => {
        await context.browserManager.navigate(args.url);
        return {
            content: [
                {
                    type: 'text',
                    text: `Successfully navigated to ${args.url}`,
                },
            ],
        };
    },
};

