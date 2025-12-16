import { Page } from 'puppeteer';
import { CacheStatus, GetCacheStatusParams } from '../types.js';
import { BrowserManager } from '../browser-manager.js';

/**
 * 缓存状态检查器
 */
export class CacheHandler {
  private browserManager: BrowserManager;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * 获取缓存状态
   */
  public async getCacheStatus(
    params: GetCacheStatusParams
  ): Promise<CacheStatus> {
    const page = await this.browserManager.getPage(params.url);

    // 获取 LocalStorage
    const localStorage = await page.evaluate(() => {
      const storage: Record<string, string> = {};
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            storage[key] = window.localStorage.getItem(key) || '';
          }
        }
      } catch (error) {
        // 忽略跨域错误
      }
      return storage;
    });

    // 获取 SessionStorage
    const sessionStorage = await page.evaluate(() => {
      const storage: Record<string, string> = {};
      try {
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            storage[key] = window.sessionStorage.getItem(key) || '';
          }
        }
      } catch (error) {
        // 忽略跨域错误
      }
      return storage;
    });

    // 获取 Cookies
    const cookies = await page.cookies();

    // 获取 IndexedDB 数据库列表
    let indexedDB: { databases: string[] } | undefined;
    try {
      const dbNames = await page.evaluate(() => {
        return new Promise<string[]>((resolve) => {
          if (!window.indexedDB) {
            resolve([]);
            return;
          }

          const request = window.indexedDB.databases();
          request
            .then((databases) => {
              resolve(databases.map((db) => db.name || ''));
            })
            .catch(() => {
              resolve([]);
            });
        });
      });
      indexedDB = { databases: dbNames };
    } catch (error) {
      // IndexedDB 可能不可用
      indexedDB = undefined;
    }

    return {
      localStorage,
      sessionStorage,
      cookies: cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite || 'None',
      })),
      indexedDB,
    };
  }

  /**
   * 清除 LocalStorage
   */
  public async clearLocalStorage(url?: string): Promise<void> {
    const page = await this.browserManager.getPage(url);
    await page.evaluate(() => {
      window.localStorage.clear();
    });
  }

  /**
   * 清除 SessionStorage
   */
  public async clearSessionStorage(url?: string): Promise<void> {
    const page = await this.browserManager.getPage(url);
    await page.evaluate(() => {
      window.sessionStorage.clear();
    });
  }

  /**
   * 清除 Cookies
   */
  public async clearCookies(url?: string): Promise<void> {
    const page = await this.browserManager.getPage(url);
    const client = await page.target().createCDPSession();
    try {
      await client.send('Network.clearBrowserCookies');
    } finally {
      // 确保 CDP 连接被正确关闭
      try {
        await client.detach();
      } catch (error) {
        // 忽略关闭错误
      }
    }
  }
}

