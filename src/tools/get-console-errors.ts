import { z } from 'zod';
import { ToolDefinition, ToolContext } from './types.js';

/**
 * 获取 Console 错误工具定义
 */
export const getConsoleErrorsTool: ToolDefinition = {
    name: 'get_console_errors',
    description: '获取 Console 异常和日志',
    inputSchema: z.object({
        url: z.string().optional().describe('页面 URL（可选，如果未提供则使用当前页面）'),
        level: z.enum(['error', 'warning', 'all']).optional().default('all').describe('日志级别过滤'),
    }),
    handler: async (
        args: { url?: string; level?: 'error' | 'warning' | 'all' },
        context: ToolContext
    ) => {
        const logs = await context.consoleHandler.getConsoleErrors({
            url: args.url,
            level: args.level || 'all',
        });

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(logs, null, 2),
                },
            ],
        };
    },
};

