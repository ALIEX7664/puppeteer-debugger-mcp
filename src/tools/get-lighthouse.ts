import { z } from 'zod';
import { ToolDefinition, ToolContext } from './types.js';

/**
 * 获取 Lighthouse 报告工具定义
 */
export const getLighthouseTool: ToolDefinition = {
  name: 'get_lighthouse',
  description: '获取 Lighthouse 性能报告（包括性能、可访问性、最佳实践、SEO 等指标）',
  inputSchema: z.object({
    url: z.string().optional().describe('页面 URL（可选）'),
    onlyCategories: z
      .array(z.string())
      .optional()
      .describe('只分析的类别（可选，如：performance, accessibility, best-practices, seo）'),
  }),
  handler: async (
    args: { url?: string; onlyCategories?: string[] },
    context: ToolContext
  ) => {
    const report = await context.lighthouseHandler.getLighthouseReport({
      url: args.url,
      onlyCategories: args.onlyCategories,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(report, null, 2),
        },
      ],
    };
  },
};

