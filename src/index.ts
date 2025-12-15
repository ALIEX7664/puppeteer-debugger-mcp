

/**
 * MCP Server 入口文件
 * 
 * 这个文件是浏览器调试 MCP Server 的主入口点。
 * 它使用 @modelcontextprotocol/sdk 来创建一个 MCP Server，
 * 通过 stdio（标准输入输出）与 MCP 客户端通信。
 */

// 导入 McpServer 类 - 这是 MCP SDK 提供的高级服务器类
// McpServer 封装了底层的 Server 类，提供了更简单的 API 来注册工具、资源和提示
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// 导入 StdioServerTransport - 这是用于标准输入输出通信的传输层
// MCP Server 通过 stdio 与客户端通信，这意味着它从 stdin 读取请求，向 stdout 写入响应
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// 导入 z (zod) - 用于定义和验证工具的参数模式
// zod 是一个 TypeScript 优先的模式验证库，用于在运行时验证数据
import { z } from 'zod';

// 导入我们自定义的模块
import { BrowserManager } from './browser-manager.js';
import { ConsoleHandler } from './cdp-handlers/console-handler.js';
import { ElementHandler } from './cdp-handlers/element-handler.js';
import { CacheHandler } from './cdp-handlers/cache-handler.js';
import { PerformanceHandler } from './cdp-handlers/performance-handler.js';
import { HeapHandler } from './cdp-handlers/heap-handler.js';

// 版本号会在构建时通过 tsup 的 define 选项内联
// 这样无需运行时读取 package.json，也无需每次手动修改版本号
declare const __PACKAGE_VERSION__: string;
const version = __PACKAGE_VERSION__;

/**
 * DebuggerMCPServer 类
 * 
 * 这是我们的 MCP Server 主类，负责：
 * 1. 初始化 MCP Server 实例
 * 2. 注册所有可用的工具（tools）
 * 3. 处理来自客户端的工具调用请求
 * 4. 管理浏览器实例和各个功能处理器
 */
class DebuggerMCPServer {
  // MCP Server 实例 - 这是与客户端通信的核心对象
  private server: McpServer;

  // 浏览器管理器 - 负责管理 Puppeteer 浏览器实例和页面
  private browserManager: BrowserManager;

  // 各个功能处理器 - 每个处理器负责特定的调试功能
  private consoleHandler: ConsoleHandler;      // Console 日志处理
  private elementHandler: ElementHandler;       // DOM 元素检查
  private cacheHandler: CacheHandler;           // 缓存状态检查
  private performanceHandler: PerformanceHandler; // 性能数据收集
  private heapHandler: HeapHandler;             // 内存堆栈分析

  /**
   * 构造函数
   * 
   * 在创建 DebuggerMCPServer 实例时，会：
   * 1. 创建并配置 MCP Server
   * 2. 初始化浏览器管理器和各个处理器
   * 3. 注册所有工具
   */
  constructor() {
    // 创建 McpServer 实例
    // 第一个参数是服务器信息（名称和版本）
    // 第二个参数是服务器选项，包括能力声明（capabilities）
    this.server = new McpServer(
      {
        name: 'puppeteer-debugger-mcp',      // 服务器名称，客户端会看到这个名称
        version: version,          // 服务器版本号
      },
      {
        // capabilities 声明服务器支持的功能
        // tools: {} 表示我们支持工具功能
        capabilities: {
          tools: {},
        },
      }
    );

    // 初始化浏览器管理器（单例模式）
    // BrowserManager 负责管理 Puppeteer 浏览器实例
    this.browserManager = BrowserManager.getInstance();

    // 初始化各个功能处理器
    // 每个处理器都需要浏览器管理器来获取页面实例
    this.consoleHandler = new ConsoleHandler(this.browserManager);
    this.elementHandler = new ElementHandler(this.browserManager);
    this.cacheHandler = new CacheHandler(this.browserManager);
    this.performanceHandler = new PerformanceHandler(this.browserManager);
    this.heapHandler = new HeapHandler(this.browserManager);

    // 注册所有工具
    // 这一步会将所有工具注册到 MCP Server，使客户端可以调用它们
    this.registerTools();
  }

  /**
   * 注册所有工具
   * 
   * 使用 McpServer 的 registerTool 方法注册每个工具。
   * registerTool 方法需要：
   * 1. 工具名称（name）
   * 2. 工具配置（config）- 包括描述、输入模式等
   * 3. 工具处理函数（callback）- 当客户端调用工具时执行的函数
   */
  private registerTools(): void {
    // ========== 工具 1: navigate ==========
    // 导航到指定 URL
    this.server.registerTool(
      'navigate',
      {
        description: '导航到指定 URL',
        // inputSchema 定义了工具接受的参数
        // 使用 zod 来定义参数模式，这样可以自动验证参数类型
        inputSchema: z.object({
          url: z.string().describe('要导航到的 URL'),
        }),
      },
      // 工具处理函数
      // args 是经过验证的参数对象，类型由 inputSchema 自动推断
      // extra 包含请求的额外信息（如请求 ID、会话信息等）
      async (args: { url: string }) => {
        await this.browserManager.navigate(args.url);
        // 返回工具执行结果
        // content 数组包含返回给客户端的内容
        return {
          content: [
            {
              type: 'text',
              text: `Successfully navigated to ${args.url}`,
            },
          ],
        };
      }
    );

    // ========== 工具 2: get_console_errors ==========
    // 获取 Console 异常和日志
    this.server.registerTool(
      'get_console_errors',
      {
        description: '获取 Console 异常和日志',
        inputSchema: z.object({
          url: z.string().optional().describe('页面 URL（可选，如果未提供则使用当前页面）'),
          level: z.enum(['error', 'warning', 'all']).optional().default('all').describe('日志级别过滤'),
        }),
      },
      async (args: { url?: string; level?: 'error' | 'warning' | 'all' }) => {
        const logs = await this.consoleHandler.getConsoleErrors({
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
      }
    );

    // ========== 工具 3: check_element ==========
    // 检查元素状态（属性、样式、可见性等）
    this.server.registerTool(
      'check_element',
      {
        description: '检查元素状态（属性、样式、可见性等）',
        inputSchema: z.object({
          selector: z.string().describe('CSS 选择器'),
          url: z.string().optional().describe('页面 URL（可选）'),
        }),
      },
      async (args: { selector: string; url?: string }) => {
        const elementState = await this.elementHandler.checkElement({
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
      }
    );

    // ========== 工具 4: get_cache_status ==========
    // 获取缓存状态（LocalStorage、SessionStorage、Cookies、IndexedDB）
    this.server.registerTool(
      'get_cache_status',
      {
        description: '获取缓存状态（LocalStorage、SessionStorage、Cookies、IndexedDB）',
        inputSchema: z.object({
          url: z.string().optional().describe('页面 URL（可选）'),
        }),
      },
      async (args: { url?: string }) => {
        const cacheStatus = await this.cacheHandler.getCacheStatus({
          url: args.url,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cacheStatus, null, 2),
            },
          ],
        };
      }
    );

    // ========== 工具 5: get_performance ==========
    // 获取性能数据（Performance Timeline、页面加载指标）
    this.server.registerTool(
      'get_performance',
      {
        description: '获取性能数据（Performance Timeline、页面加载指标）',
        inputSchema: z.object({
          url: z.string().optional().describe('页面 URL（可选）'),
        }),
      },
      async (args: { url?: string }) => {
        const performance = await this.performanceHandler.getPerformance({
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
      }
    );

    // ========== 工具 6: get_heap_snapshot ==========
    // 获取堆快照
    this.server.registerTool(
      'get_heap_snapshot',
      {
        description: '获取堆快照',
        inputSchema: z.object({
          url: z.string().optional().describe('页面 URL（可选）'),
        }),
      },
      async (args: { url?: string }) => {
        const snapshot = await this.heapHandler.getHeapSnapshot({
          url: args.url,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(snapshot, null, 2),
            },
          ],
        };
      }
    );

    // ========== 工具 7: analyze_memory ==========
    // 分析内存使用情况
    this.server.registerTool(
      'analyze_memory',
      {
        description: '分析内存使用情况',
        inputSchema: z.object({
          url: z.string().optional().describe('页面 URL（可选）'),
        }),
      },
      async (args: { url?: string }) => {
        const analysis = await this.heapHandler.analyzeMemory({
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
      }
    );

    // ========== 工具 8: track_allocations ==========
    // 跟踪对象分配
    this.server.registerTool(
      'track_allocations',
      {
        description: '跟踪对象分配',
        inputSchema: z.object({
          url: z.string().optional().describe('页面 URL（可选）'),
          duration: z.number().optional().default(5000).describe('跟踪时长（毫秒），默认 5000'),
        }),
      },
      async (args: { url?: string; duration?: number }) => {
        const tracking = await this.heapHandler.trackAllocations({
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
      }
    );

    // ========== 工具 9: take_screenshot ==========
    // 截图（辅助调试）
    this.server.registerTool(
      'take_screenshot',
      {
        description: '截图（辅助调试）',
        inputSchema: z.object({
          url: z.string().optional().describe('页面 URL（可选）'),
          fullPage: z.boolean().optional().default(false).describe('是否截取整页'),
        }),
      },
      async (args: { url?: string; fullPage?: boolean }) => {
        const page = await this.browserManager.getPage(args.url);
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
      }
    );
  }

  /**
   * 启动服务器
   * 
   * 这个方法会：
   * 1. 创建 stdio 传输层
   * 2. 将服务器连接到传输层
   * 3. 初始化浏览器实例
   * 4. 设置优雅关闭处理
   */
  public async start(): Promise<void> {
    // 创建 stdio 传输层
    // StdioServerTransport 会从 stdin 读取请求，向 stdout 写入响应
    const transport = new StdioServerTransport();

    // 将服务器连接到传输层
    // 连接后，服务器开始监听来自客户端的请求
    await this.server.connect(transport);

    // 延迟初始化浏览器（在后台异步初始化，不阻塞服务器启动）
    // 这样即使浏览器初始化失败，服务器仍然可以启动并响应请求
    // 浏览器会在第一次使用时自动初始化
    this.browserManager.initialize().catch((error) => {
      // 错误输出到 stderr，避免干扰 MCP 协议的 stdout 通信
      console.error('Warning: Failed to initialize browser:', error);
      console.error('Browser will be initialized on first use.');
    });

    // 设置优雅关闭处理
    // 当收到 SIGINT（Ctrl+C）或 SIGTERM 信号时，关闭浏览器并退出

    // SIGINT 处理（通常是 Ctrl+C）
    process.on('SIGINT', async () => {
      await this.browserManager.close();  // 关闭浏览器
      await this.server.close();          // 关闭服务器连接
      process.exit(0);                    // 退出进程
    });

    // SIGTERM 处理（通常是系统关闭信号）
    process.on('SIGTERM', async () => {
      await this.browserManager.close();  // 关闭浏览器
      await this.server.close();          // 关闭服务器连接
      process.exit(0);                    // 退出进程
    });
  }
}

// ========== 程序入口 ==========
// 创建服务器实例并启动

// 创建 DebuggerMCPServer 实例
const server = new DebuggerMCPServer();

// 启动服务器
// 如果启动失败，打印错误并退出
// 注意：错误输出到 stderr，避免干扰 MCP 协议的 stdout 通信
server.start().catch((error) => {
  // 使用 console.error 输出到 stderr
  console.error('Failed to start server:', error);
  // 确保错误信息完整输出后再退出
  setTimeout(() => {
    process.exit(1);
  }, 100);
});
