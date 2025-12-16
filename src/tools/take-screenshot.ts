import { z } from 'zod';
import { ToolDefinition, ToolContext } from './types.js';

/**
 * 截图工具定义
 */
export const takeScreenshotTool: ToolDefinition = {
    name: 'take_screenshot',
    description: '截图（辅助调试）',
    inputSchema: z.object({
        url: z.string().optional().describe('页面 URL（可选）'),
        fullPage: z.boolean().optional().default(false).describe('是否截取整页'),
    }),
    handler: async (
        args: { url?: string; fullPage?: boolean },
        context: ToolContext
    ) => {
        const page = await context.browserManager.getPage(args.url);
        const screenshot = await page.screenshot({
            fullPage: args.fullPage || false,
            encoding: 'base64',
        });

        return {
            content: [
                {
                    type: 'text',
                    text: `Screenshot taken (base64): ${screenshot}`,
                },
            ],
        };
    },
};

