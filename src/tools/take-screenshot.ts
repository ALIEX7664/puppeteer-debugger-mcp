import { z } from 'zod';
import { ToolDefinition, ToolContext } from './types.js';
import {
  saveScreenshotToFile,
  ensurePageFullyLoaded,
  PNG_BASE64_DATA_URI_PREFIX,
} from '../utils/screenshot-utils.js';

/**
 * 截图工具定义
 */
export const takeScreenshotTool: ToolDefinition = {
  name: 'take_screenshot',
  description: '截图（辅助调试）',
  inputSchema: z.object({
    url: z.string().optional().describe('页面 URL（可选）'),
    fullPage: z.boolean().optional().default(false).describe('是否截取整页'),
    outputMode: z
      .enum(['auto', 'file', 'inline'])
      .optional()
      .default('auto')
      .describe(
        [
          '输出模式：',
          '- auto：根据图片大小自动选择（小图片返回 base64，大图片保存为文件）',
          '- file：始终保存为文件，返回路径',
          '- inline：始终返回 base64（仅用于小图片）',
        ].join('\n')
      ),
    filePath: z
      .string()
      .optional()
      .describe('文件保存路径（可选，file/auto 模式使用，默认：./screenshots/screenshot-{timestamp}-{random}.png）'),
    maxBase64SizeKB: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe('auto 模式阈值（KB，base64 大小，默认 100KB base64 ≈ 75KB 原图）'),
    scrollDelay: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .default(1000)
      .describe('滚动后等待时间（毫秒，用于触发懒加载，默认 1000）'),
    waitForSelector: z
      .string()
      .optional()
      .describe('等待特定选择器加载（可选，字符串）'),
  }),
  handler: async (
    args: {
      url?: string;
      fullPage?: boolean;
      outputMode?: 'auto' | 'file' | 'inline';
      filePath?: string;
      maxBase64SizeKB?: number;
      scrollDelay?: number;
      waitForSelector?: string;
    },
    context: ToolContext
  ) => {
    const page = await context.browserManager.getPage(args.url);

    // 如果指定了 waitForSelector，等待元素加载
    if (args.waitForSelector) {
      try {
        await page.waitForSelector(args.waitForSelector, { timeout: 10000 });
      } catch {
        // 如果超时，继续执行
      }
    }

    // 如果 fullPage 为 true，执行改进的全页截图流程
    if (args.fullPage) {
      await ensurePageFullyLoaded(page, args.scrollDelay ?? 1000);
    }

    // 根据 outputMode 决定编码方式
    // inline 模式：直接使用 base64
    // file/auto 模式：使用 Buffer（更高效，避免不必要的转换）
    const shouldUseBase64 = args.outputMode === 'inline';

    // 执行截图
    const screenshot = (await page.screenshot({
      fullPage: args.fullPage || false,
      encoding: shouldUseBase64 ? ('base64' as const) : undefined,
    })) as Buffer | string;

    // inline 模式：直接返回 base64
    if (args.outputMode === 'inline') {
      // screenshot 可能是 base64 字符串，需要确保有 data URI 前缀
      let base64String: string;
      if (typeof screenshot === 'string') {
        base64String = screenshot.startsWith('data:')
          ? screenshot
          : `${PNG_BASE64_DATA_URI_PREFIX}${screenshot}`;
      } else {
        base64String = `${PNG_BASE64_DATA_URI_PREFIX}${screenshot.toString('base64')}`;
      }
      return {
        content: [
          {
            type: 'text',
            text: `Screenshot taken (base64): ${base64String}`,
          },
        ],
      };
    }

    // file/auto 模式：使用 Buffer
    const buffer: Buffer =
      typeof screenshot === 'string'
        ? Buffer.from(
          screenshot.replace(
            new RegExp(`^${PNG_BASE64_DATA_URI_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
            ''
          ),
          'base64'
        )
        : screenshot;

    // file 模式：始终保存为文件
    if (args.outputMode === 'file') {
      const result = await saveScreenshotToFile(buffer, args.filePath);
      const sizeKB = Math.round(result.size / 1024);
      return {
        content: [
          {
            type: 'text',
            text: `Screenshot saved to: ${result.filePath}\nFile size: ${sizeKB}KB`,
          },
        ],
      };
    }

    // auto 模式：根据大小自动选择
    // 计算 base64 大小（约为 Buffer 大小的 4/3）
    const bufferSizeKB = Math.round(buffer.length / 1024);
    const estimatedBase64SizeKB = Math.round((buffer.length * 4) / 3 / 1024);
    const thresholdKB = args.maxBase64SizeKB || 100;

    if (estimatedBase64SizeKB <= thresholdKB) {
      // 小图片：返回 base64
      const base64String = `${PNG_BASE64_DATA_URI_PREFIX}${buffer.toString('base64')}`;
      return {
        content: [
          {
            type: 'text',
            text: `Screenshot taken (base64): ${base64String}`,
          },
        ],
      };
    } else {
      // 大图片：保存为文件
      const result = await saveScreenshotToFile(buffer, args.filePath);
      const sizeKB = Math.round(result.size / 1024);
      return {
        content: [
          {
            type: 'text',
            text: `Screenshot saved to: ${result.filePath}\nFile size: ${sizeKB}KB (estimated base64 size: ${estimatedBase64SizeKB}KB, exceeded threshold: ${thresholdKB}KB)`,
          },
        ],
      };
    }
  },
};

