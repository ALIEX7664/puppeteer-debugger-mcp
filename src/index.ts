

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

// 注意：zod 的导入已移至工具定义文件中

// 导入我们自定义的模块
import { BrowserManager } from './browser-manager.js';
import { ConsoleHandler } from './cdp-handlers/console-handler.js';
import { ElementHandler } from './cdp-handlers/element-handler.js';
import { CacheHandler } from './cdp-handlers/cache-handler.js';
import { PerformanceHandler } from './cdp-handlers/performance-handler.js';
import { HeapHandler } from './cdp-handlers/heap-handler.js';
import { LighthouseHandler } from './cdp-handlers/lighthouse-handler.js';
import { registerAllTools } from './tools/index.js';

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

  // 关闭标志，防止重复关闭
  private isShuttingDown: boolean = false;

  // 各个功能处理器 - 每个处理器负责特定的调试功能
  private consoleHandler: ConsoleHandler;      // Console 日志处理
  private elementHandler: ElementHandler;       // DOM 元素检查
  private cacheHandler: CacheHandler;           // 缓存状态检查
  private performanceHandler: PerformanceHandler; // 性能数据收集
  private heapHandler: HeapHandler;             // 内存堆栈分析
  private lighthouseHandler: LighthouseHandler;  // Lighthouse 性能分析

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
    this.lighthouseHandler = new LighthouseHandler(this.browserManager);

    // 注册所有工具
    // 这一步会将所有工具注册到 MCP Server，使客户端可以调用它们
    this.registerTools();
  }

  /**
   * 注册所有工具
   * 
   * 使用统一的工具注册管理器来注册所有工具。
   * 每个工具的定义都在独立的文件中，便于管理和维护。
   */
  private registerTools(): void {
    // 创建工具上下文，包含所有需要的处理器和管理器
    const context = {
      browserManager: this.browserManager,
      consoleHandler: this.consoleHandler,
      elementHandler: this.elementHandler,
      cacheHandler: this.cacheHandler,
      performanceHandler: this.performanceHandler,
      heapHandler: this.heapHandler,
      lighthouseHandler: this.lighthouseHandler,
    };

    // 使用统一的工具注册函数注册所有工具
    registerAllTools(this.server, context);
  }

  /**
   * 优雅关闭和清理资源
   * 统一的清理函数，确保所有资源都被正确释放
   * 使用标志防止重复关闭
   */
  private async gracefulShutdown(exitCode: number = 0): Promise<void> {
    // 防止重复关闭
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    try {
      // 关闭浏览器（如果已初始化）
      if (this.browserManager.isInitialized()) {
        await this.browserManager.close();
      }

      // 关闭 MCP 服务器连接
      await this.server.close();
    } catch (error) {
      // 记录错误但不阻止退出
      console.error('Error during graceful shutdown:', error);
    } finally {
      // 确保进程退出
      process.exit(exitCode);
    }
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

    // 浏览器将在第一次调用 MCP 工具时自动初始化（通过 getPage() 或 navigate()）
    // 这样可以避免在服务器启动时立即启动浏览器进程，节省资源
    // 所有工具处理函数都会通过 browserManager.getPage() 获取页面，
    // 而 getPage() 方法会在浏览器未初始化时自动调用 initialize()

    // 设置优雅关闭处理
    // 监听多种关闭场景，确保在 MCP 禁用时能够正确清理资源并退出进程

    // SIGINT 处理（通常是 Ctrl+C）
    process.on('SIGINT', () => {
      this.gracefulShutdown(0);
    });

    // SIGTERM 处理（通常是系统关闭信号）
    process.on('SIGTERM', () => {
      this.gracefulShutdown(0);
    });

    // 监听 stdin 关闭事件（当 Cursor 禁用 MCP 时会关闭 stdin）
    // 这是检测 MCP 被禁用的关键方式
    // 同时监听 'end' 和 'close' 事件，确保能够捕获所有关闭场景
    const handleStdinClose = () => {
      this.gracefulShutdown(0);
    };

    // 监听 stdin 的 'end' 事件（当输入流结束时触发）
    // 这通常发生在 Cursor 关闭 MCP 连接时
    process.stdin.on('end', handleStdinClose);

    // 监听 stdin 的 'close' 事件（当底层文件描述符关闭时触发）
    // 这是更底层的关闭事件，作为备用检测方式
    process.stdin.on('close', handleStdinClose);

    // 注意：process.on('exit') 中不能使用异步操作
    // 清理工作应该在 gracefulShutdown 中完成，这里不需要额外处理

    // 处理未捕获的异常，确保浏览器被正确关闭
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await this.gracefulShutdown(1);
    });

    // 处理未处理的 Promise 拒绝
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      // 注意：不要在这里关闭浏览器，因为这可能是临时错误
      // 但如果错误严重，可以考虑退出
      if (reason instanceof Error && reason.message.includes('ECONNRESET')) {
        // 如果是连接重置错误，可能是 MCP 客户端断开连接
        await this.gracefulShutdown(0);
      }
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
