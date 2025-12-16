import { z } from 'zod';
import { BrowserManager } from '../browser-manager.js';
import { ConsoleHandler } from '../cdp-handlers/console-handler.js';
import { ElementHandler } from '../cdp-handlers/element-handler.js';
import { CacheHandler } from '../cdp-handlers/cache-handler.js';
import { PerformanceHandler } from '../cdp-handlers/performance-handler.js';
import { HeapHandler } from '../cdp-handlers/heap-handler.js';
import { LighthouseHandler } from '../cdp-handlers/lighthouse-handler.js';

/**
 * 工具上下文，包含所有需要的处理器和管理器
 */
export interface ToolContext {
    browserManager: BrowserManager;
    consoleHandler: ConsoleHandler;
    elementHandler: ElementHandler;
    cacheHandler: CacheHandler;
    performanceHandler: PerformanceHandler;
    heapHandler: HeapHandler;
    lighthouseHandler: LighthouseHandler;
}

/**
 * 工具定义接口
 */
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: z.ZodTypeAny;
    handler: (args: any, context: ToolContext) => Promise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }>;
}

