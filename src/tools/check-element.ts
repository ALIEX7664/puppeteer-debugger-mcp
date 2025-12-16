import { z } from 'zod';
import { ToolDefinition, ToolContext } from './types.js';

/**
 * 检查元素工具定义
 */
export const checkElementTool: ToolDefinition = {
    name: 'check_element',
    description: '检查元素状态（属性、样式、可见性等）',
    inputSchema: z.object({
        selector: z.string().describe('CSS 选择器'),
        url: z.string().optional().describe('页面 URL（可选）'),
    }),
    handler: async (
        args: { selector: string; url?: string },
        context: ToolContext
    ) => {
        const elementState = await context.elementHandler.checkElement({
            selector: args.selector,
            url: args.url,
        });

        if (!elementState) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Element not found: ${args.selector}`,
                    },
                ],
            };
        }

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(elementState, null, 2),
                },
            ],
        };
    },
};

