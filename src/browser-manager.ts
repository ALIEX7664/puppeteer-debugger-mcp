import puppeteer, { Browser, Page } from 'puppeteer-core';
import { BrowserConfig, PageInfo } from './types.js';
import { existsSync } from 'fs';
import { access } from 'fs/promises';

/**
 * 浏览器管理器 - 单例模式管理持久化浏览器连接
 */
export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private pages: Map<string, PageInfo> = new Map();
  private config: BrowserConfig;
  // 添加初始化锁，防止并发初始化导致多个浏览器进程
  private initializing: Promise<void> | null = null;
  // 最大页面数量限制，防止内存泄漏
  private readonly maxPages = 5;
  // 页面清理间隔（毫秒）
  private readonly pageCleanupInterval = 5 * 60 * 1000; // 5 分钟
  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor(config: BrowserConfig = {}) {
    // 优化浏览器启动参数，减少内存占用
    const defaultArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // 减少共享内存使用
      '--disable-gpu', // 禁用 GPU 加速
      '--disable-software-rasterizer', // 禁用软件光栅化
      '--disable-extensions', // 禁用扩展
      '--disable-plugins', // 禁用插件
      '--disable-background-networking', // 禁用后台网络
      '--disable-background-timer-throttling', // 禁用后台定时器节流
      '--disable-renderer-backgrounding', // 禁用渲染器后台化
      '--disable-backgrounding-occluded-windows', // 禁用被遮挡窗口的后台化
      '--disable-breakpad', // 禁用崩溃报告
      '--disable-component-update', // 禁用组件更新
      '--disable-default-apps', // 禁用默认应用
      '--disable-domain-reliability', // 禁用域可靠性
      '--disable-features=TranslateUI', // 禁用翻译 UI
      '--disable-ipc-flooding-protection', // 禁用 IPC 洪水保护
      '--disable-sync', // 禁用同步
      '--metrics-recording-only', // 仅记录指标
      '--no-first-run', // 不首次运行
      '--no-default-browser-check', // 不检查默认浏览器
      '--mute-audio', // 静音
      '--hide-scrollbars', // 隐藏滚动条
      '--disable-notifications', // 禁用通知
      '--disable-web-security', // 禁用 Web 安全（仅用于调试）
      '--disable-features=VizDisplayCompositor', // 禁用显示合成器
    ];

    this.config = {
      headless: true,
      args: config.args || defaultArgs,
      timeout: 30000,
      ...config,
    };
  }

  /**
   * 获取单例实例
   */
  public static getInstance(config?: BrowserConfig): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager(config);
    }
    return BrowserManager.instance;
  }

  /**
   * 初始化浏览器实例
   * 添加了并发保护，确保即使多个调用同时发生，也只会初始化一次
   */
  public async initialize(): Promise<void> {
    // 如果已经初始化，直接返回
    if (this.browser) {
      return;
    }

    // 如果正在初始化，等待初始化完成
    if (this.initializing) {
      return this.initializing;
    }

    // 创建初始化 Promise，确保并发调用时只初始化一次
    this.initializing = (async () => {
      try {
        // 再次检查（防止在等待期间已经初始化）
        if (this.browser) {
          return;
        }

        // 查找并验证 Chrome/Chromium 可执行文件路径
        const executablePath = await this.findChromeExecutablePath();

        this.browser = await puppeteer.launch({
          headless: this.config.headless,
          args: this.config.args,
          executablePath,
          // 优化内存使用
          protocol: 'cdp',
          ignoreHTTPSErrors: true,
        });

        // 启动页面清理定时器
        this.startPageCleanup();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to launch browser: ${errorMessage}\n` +
          `Please ensure Chrome or Chromium is installed.\n` +
          `You can set PUPPETEER_EXECUTABLE_PATH environment variable to specify the Chrome path.`
        );
      } finally {
        // 清除初始化锁
        this.initializing = null;
      }
    })();

    return this.initializing;
  }

  /**
   * 查找并验证 Chrome/Chromium 可执行文件路径
   * 支持跨平台和自定义路径，如果找不到则抛出明确的错误
   */
  private async findChromeExecutablePath(): Promise<string> {
    // 优先使用环境变量指定的路径
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
      if (await this.checkFileExists(envPath)) {
        return envPath;
      }
      throw new Error(
        `指定的浏览器路径不存在: ${envPath}\n` +
        `请检查 PUPPETEER_EXECUTABLE_PATH 环境变量是否正确，或安装 Chrome/Chromium 浏览器。`
      );
    }

    // 根据平台查找浏览器
    const platform = process.platform;
    let searchPaths: string[] = [];

    if (platform === 'win32') {
      // Windows 常见路径
      searchPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
        'C:\\Program Files\\Chromium\\Application\\chromium.exe',
        'C:\\Program Files (x86)\\Chromium\\Application\\chromium.exe',
        `${process.env.LOCALAPPDATA}\\Chromium\\Application\\chromium.exe`,
      ];
    } else if (platform === 'darwin') {
      // macOS 路径
      searchPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/local/bin/chrome',
        '/usr/local/bin/chromium',
      ];
    } else if (platform === 'linux') {
      // Linux 常见路径
      searchPaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
        '/usr/local/bin/chrome',
        '/usr/local/bin/chromium',
      ];
    }

    // 检查每个路径，返回第一个存在的
    for (const path of searchPaths) {
      if (path && await this.checkFileExists(path)) {
        return path;
      }
    }

    // 如果所有路径都不存在，抛出明确的错误
    const platformName = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux';
    throw new Error(
      `未找到系统浏览器（Chrome/Chromium）。\n` +
      `请安装 Chrome 或 Chromium 浏览器，或通过 PUPPETEER_EXECUTABLE_PATH 环境变量指定浏览器路径。\n` +
      `\n${platformName} 系统常见安装路径：\n` +
      searchPaths.map(p => `  - ${p}`).join('\n') +
      `\n\n安装指南：\n` +
      `  - Chrome: https://www.google.com/chrome/\n` +
      `  - Chromium: https://www.chromium.org/getting-involved/download-chromium`
    );
  }

  /**
   * 检查文件是否存在且可访问
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    if (!filePath) {
      return false;
    }
    try {
      // 使用 existsSync 进行快速检查
      if (!existsSync(filePath)) {
        return false;
      }
      // 使用 access 检查文件是否可读
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取或创建页面
   */
  public async getPage(url?: string): Promise<Page> {
    if (!this.browser) {
      await this.initialize();
    }

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    // 如果提供了 URL，尝试查找现有页面或创建新页面
    if (url) {
      const normalizedUrl = this.normalizeUrl(url);

      // 检查是否已有该 URL 的页面
      if (this.pages.has(normalizedUrl)) {
        const pageInfo = this.pages.get(normalizedUrl)!;
        // 检查页面是否仍然有效
        if (!pageInfo.page.isClosed()) {
          return pageInfo.page;
        } else {
          // 页面已关闭，移除并创建新页面
          this.pages.delete(normalizedUrl);
        }
      }

      // 检查页面数量限制，如果超过限制则清理最旧的页面
      await this.cleanupOldPagesIfNeeded();

      // 创建新页面
      const page = await this.browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // 导航到 URL
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout,
      });

      // 保存页面信息
      this.pages.set(normalizedUrl, {
        page,
        url: normalizedUrl,
        createdAt: new Date(),
      });

      return page;
    }

    // 如果没有提供 URL，返回第一个可用页面或创建新页面
    const firstPage = Array.from(this.pages.values())[0];
    if (firstPage && !firstPage.page.isClosed()) {
      return firstPage.page;
    }

    // 创建新页面
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    return page;
  }

  /**
   * 导航到指定 URL
   */
  public async navigate(url: string): Promise<Page> {
    const page = await this.getPage(url);
    const normalizedUrl = this.normalizeUrl(url);

    // 如果页面已存在，导航到新 URL
    if (!page.url() || page.url() !== normalizedUrl) {
      await page.goto(normalizedUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout,
      });

      // 更新页面信息
      if (this.pages.has(normalizedUrl)) {
        const pageInfo = this.pages.get(normalizedUrl)!;
        pageInfo.url = normalizedUrl;
      } else {
        this.pages.set(normalizedUrl, {
          page,
          url: normalizedUrl,
          createdAt: new Date(),
        });
      }
    }

    return page;
  }

  /**
   * 获取所有页面
   */
  public getPages(): PageInfo[] {
    return Array.from(this.pages.values()).filter(
      (info) => !info.page.isClosed()
    );
  }

  /**
   * 关闭指定 URL 的页面
   */
  public async closePage(url: string): Promise<void> {
    const normalizedUrl = this.normalizeUrl(url);
    const pageInfo = this.pages.get(normalizedUrl);

    if (pageInfo && !pageInfo.page.isClosed()) {
      try {
        // 移除所有事件监听器，防止内存泄漏
        pageInfo.page.removeAllListeners();
        await pageInfo.page.close();
      } catch (error) {
        // 忽略关闭错误
      } finally {
        this.pages.delete(normalizedUrl);
      }
    }
  }

  /**
   * 关闭所有页面
   */
  public async closeAllPages(): Promise<void> {
    const closePromises = Array.from(this.pages.values())
      .filter((info) => !info.page.isClosed())
      .map(async (info) => {
        try {
          // 移除所有事件监听器，防止内存泄漏
          info.page.removeAllListeners();
          await info.page.close();
        } catch (error) {
          // 忽略关闭错误
        }
      });

    await Promise.all(closePromises);
    this.pages.clear();
  }

  /**
   * 启动页面清理定时器
   */
  private startPageCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(async () => {
      await this.cleanupOldPages();
    }, this.pageCleanupInterval);
  }

  /**
   * 停止页面清理定时器
   */
  private stopPageCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 清理旧页面（如果超过限制）
   */
  private async cleanupOldPagesIfNeeded(): Promise<void> {
    if (this.pages.size < this.maxPages) {
      return;
    }

    // 按创建时间排序，删除最旧的页面
    const sortedPages = Array.from(this.pages.entries())
      .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());

    const pagesToRemove = sortedPages.slice(0, this.pages.size - this.maxPages + 1);

    for (const [url, pageInfo] of pagesToRemove) {
      try {
        if (!pageInfo.page.isClosed()) {
          await pageInfo.page.close();
        }
      } catch (error) {
        // 忽略关闭错误
      }
      this.pages.delete(url);
    }
  }

  /**
   * 清理旧页面（定期清理）
   */
  private async cleanupOldPages(): Promise<void> {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 分钟

    for (const [url, pageInfo] of this.pages.entries()) {
      const age = now - pageInfo.createdAt.getTime();

      if (age > maxAge) {
        try {
          if (!pageInfo.page.isClosed()) {
            await pageInfo.page.close();
          }
        } catch (error) {
          // 忽略关闭错误
        }
        this.pages.delete(url);
      }
    }
  }

  /**
   * 关闭浏览器
   */
  public async close(): Promise<void> {
    // 停止清理定时器
    this.stopPageCleanup();

    // 等待正在进行的初始化完成，避免在初始化过程中关闭
    if (this.initializing) {
      try {
        await this.initializing;
      } catch (error) {
        // 如果初始化失败，继续关闭流程
        console.error('Browser initialization failed during close:', error);
      }
    }

    await this.closeAllPages();

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        // 忽略关闭错误，可能浏览器已经关闭或进程已终止
        console.error('Error closing browser (may already be closed):', error);
      }
      this.browser = null;
    }

    // 清除初始化锁
    this.initializing = null;
  }

  /**
   * 规范化 URL
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.href;
    } catch {
      // 如果不是完整 URL，尝试添加协议
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
      }
      return url;
    }
  }

  /**
   * 检查浏览器是否已初始化
   */
  public isInitialized(): boolean {
    return this.browser !== null;
  }
}

