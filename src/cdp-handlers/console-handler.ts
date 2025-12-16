import { Page } from 'puppeteer-core';
import { ConsoleLogEntry, GetConsoleErrorsParams } from '../types.js';
import { BrowserManager } from '../browser-manager.js';

/**
 * Console 异常处理器
 */
export class ConsoleHandler {
  private browserManager: BrowserManager;
  private consoleLogs: Map<string, ConsoleLogEntry[]> = new Map();

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * 获取 Console 错误和日志
   */
  public async getConsoleErrors(
    params: GetConsoleErrorsParams
  ): Promise<ConsoleLogEntry[]> {
    const page = await this.browserManager.getPage(params.url);
    const pageUrl = page.url();

    // 如果还没有为该页面设置监听器，设置它
    if (!this.consoleLogs.has(pageUrl)) {
      this.setupConsoleListener(page, pageUrl);
      this.consoleLogs.set(pageUrl, []);
    }

    const logs = this.consoleLogs.get(pageUrl) || [];
    
    // 根据级别过滤
    if (params.level === 'error') {
      return logs.filter((log) => log.type === 'error');
    } else if (params.level === 'warning') {
      return logs.filter((log) => log.type === 'warning' || log.type === 'error');
    }

    return logs;
  }

  /**
   * 设置 Console 监听器
   * 注意：需要在页面关闭时移除监听器，防止内存泄漏
   */
  private setupConsoleListener(page: Page, pageUrl: string): void {
    // 监听页面关闭事件，清理监听器
    const cleanup = () => {
      this.consoleLogs.delete(pageUrl);
    };
    page.once('close', cleanup);

    // 监听 Console 消息
    const consoleHandler = (msg: any) => {
      const type = this.mapConsoleType(msg.type());
      const text = msg.text();
      const location = msg.location();

      const entry: ConsoleLogEntry = {
        type,
        text,
        timestamp: Date.now(),
        url: location.url,
        lineNumber: location.lineNumber,
        columnNumber: location.columnNumber,
      };

      // 如果是错误，尝试获取堆栈信息
      if (type === 'error') {
        page.evaluate(() => {
          return new Error().stack;
        }).then((stack) => {
          if (stack) {
            entry.stackTrace = stack;
          }
        }).catch(() => {
          // 忽略错误
        });
      }

      const logs = this.consoleLogs.get(pageUrl) || [];
      logs.push(entry);
      this.consoleLogs.set(pageUrl, logs);
    };
    page.on('console', consoleHandler);

    // 监听页面错误
    const pageErrorHandler = (error: Error) => {
      const entry: ConsoleLogEntry = {
        type: 'error',
        text: error.message,
        timestamp: Date.now(),
        stackTrace: error.stack,
        url: pageUrl,
      };

      const logs = this.consoleLogs.get(pageUrl) || [];
      logs.push(entry);
      this.consoleLogs.set(pageUrl, logs);
    };
    page.on('pageerror', pageErrorHandler);

    // 监听请求失败
    const requestFailedHandler = (request: any) => {
      const entry: ConsoleLogEntry = {
        type: 'error',
        text: `Request failed: ${request.url()}`,
        timestamp: Date.now(),
        url: request.url(),
      };

      const logs = this.consoleLogs.get(pageUrl) || [];
      logs.push(entry);
      this.consoleLogs.set(pageUrl, logs);
    };
    page.on('requestfailed', requestFailedHandler);

    // 在页面关闭时移除所有监听器
    page.once('close', () => {
      page.removeListener('console', consoleHandler);
      page.removeListener('pageerror', pageErrorHandler);
      page.removeListener('requestfailed', requestFailedHandler);
      this.consoleLogs.delete(pageUrl);
    });
  }

  /**
   * 映射 Console 类型
   */
  private mapConsoleType(type: string): ConsoleLogEntry['type'] {
    switch (type) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      case 'debug':
        return 'debug';
      default:
        return 'log';
    }
  }

  /**
   * 清除指定页面的日志
   */
  public clearLogs(url?: string): void {
    if (url) {
      this.consoleLogs.delete(url);
    } else {
      this.consoleLogs.clear();
    }
  }
}

