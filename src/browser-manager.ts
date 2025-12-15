import puppeteer, { Browser, Page } from 'puppeteer';
import { BrowserConfig, PageInfo } from './types.js';

/**
 * 浏览器管理器 - 单例模式管理持久化浏览器连接
 */
export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private pages: Map<string, PageInfo> = new Map();
  private config: BrowserConfig;

  private constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
   */
  public async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    try {
      // 获取 Chrome/Chromium 可执行文件路径
      const executablePath = this.getChromeExecutablePath();

      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        args: this.config.args,
        executablePath,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to launch browser: ${errorMessage}\n` +
        `Please ensure Chrome or Chromium is installed.\n` +
        `You can set PUPPETEER_EXECUTABLE_PATH environment variable to specify the Chrome path.`
      );
    }
  }

  /**
   * 获取 Chrome/Chromium 可执行文件路径
   * 支持跨平台和自定义路径
   */
  private getChromeExecutablePath(): string | undefined {
    // 优先使用环境变量指定的路径
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // 根据平台返回默认路径
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows 常见路径
      const windowsPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
      ];

      // 返回第一个存在的路径（这里只返回默认路径，实际检查由 puppeteer 处理）
      return windowsPaths[0];
    } else if (platform === 'darwin') {
      // macOS 路径
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else if (platform === 'linux') {
      // Linux 常见路径
      const linuxPaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
      ];

      return linuxPaths[0];
    }

    // 未知平台，返回 undefined，让 puppeteer 使用默认行为
    return undefined;
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
      await pageInfo.page.close();
      this.pages.delete(normalizedUrl);
    }
  }

  /**
   * 关闭所有页面
   */
  public async closeAllPages(): Promise<void> {
    const closePromises = Array.from(this.pages.values())
      .filter((info) => !info.page.isClosed())
      .map((info) => info.page.close());

    await Promise.all(closePromises);
    this.pages.clear();
  }

  /**
   * 关闭浏览器
   */
  public async close(): Promise<void> {
    await this.closeAllPages();

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
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

