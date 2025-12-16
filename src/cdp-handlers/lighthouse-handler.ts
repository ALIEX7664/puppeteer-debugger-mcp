import { Page } from 'puppeteer-core';
import lighthouse from 'lighthouse';
import { BrowserManager } from '../browser-manager.js';

export interface GetLighthouseParams {
  url?: string;
  onlyCategories?: string[];
  skipAudits?: string[];
}

/**
 * Lighthouse 性能分析处理器
 */
export class LighthouseHandler {
  private browserManager: BrowserManager;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * 获取 Lighthouse 性能报告
   */
  public async getLighthouseReport(
    params: GetLighthouseParams
  ): Promise<any> {
    const page = await this.browserManager.getPage(params.url);
    const url = page.url();

    // 获取浏览器的 WebSocket 端点
    const browser = page.browser();
    const wsEndpoint = browser.wsEndpoint();

    if (!wsEndpoint) {
      throw new Error('无法获取浏览器 WebSocket 端点，Lighthouse 需要连接到浏览器的调试端口');
    }

    // 从 WebSocket 端点提取端口号
    // wsEndpoint 格式: ws://127.0.0.1:9222/devtools/browser/...
    const wsUrl = new URL(wsEndpoint);
    const port = wsUrl.port ? parseInt(wsUrl.port) : 9222;

    // 配置 Lighthouse
    const options = {
      logLevel: 'error' as const,
      output: 'json' as const,
      onlyCategories: params.onlyCategories || [
        'performance',
        'accessibility',
        'best-practices',
        'seo',
      ],
      port,
      hostname: wsUrl.hostname || '127.0.0.1',
    };

    // 运行 Lighthouse
    const report = await lighthouse(url, options);

    if (!report) {
      throw new Error('Lighthouse 报告生成失败');
    }

    // 提取关键指标
    const lhr = report.lhr;
    const categories = lhr.categories;
    const audits = lhr.audits;

    // 构建简化的报告
    const simplifiedReport = {
      url: lhr.finalUrl,
      fetchTime: lhr.fetchTime,
      userAgent: lhr.userAgent,
      categories: {
        performance: {
          score: categories.performance?.score ? Math.round(categories.performance.score * 100) : null,
          title: categories.performance?.title,
        },
        accessibility: {
          score: categories.accessibility?.score ? Math.round(categories.accessibility.score * 100) : null,
          title: categories.accessibility?.title,
        },
        'best-practices': {
          score: categories['best-practices']?.score ? Math.round(categories['best-practices'].score * 100) : null,
          title: categories['best-practices']?.title,
        },
        seo: {
          score: categories.seo?.score ? Math.round(categories.seo.score * 100) : null,
          title: categories.seo?.title,
        },
      },
      metrics: {
        firstContentfulPaint: audits['first-contentful-paint']?.numericValue,
        largestContentfulPaint: audits['largest-contentful-paint']?.numericValue,
        totalBlockingTime: audits['total-blocking-time']?.numericValue,
        cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue,
        speedIndex: audits['speed-index']?.numericValue,
        timeToInteractive: audits['interactive']?.numericValue,
      },
      opportunities: Object.values(audits)
        .filter((audit: any) => audit.details?.type === 'opportunity' && audit.score !== null && audit.score < 1)
        .map((audit: any) => ({
          id: audit.id,
          title: audit.title,
          description: audit.description,
          score: audit.score ? Math.round(audit.score * 100) : null,
          numericValue: audit.numericValue,
          displayValue: audit.displayValue,
        }))
        .slice(0, 10), // 只返回前 10 个优化建议
      diagnostics: Object.values(audits)
        .filter((audit: any) => audit.details?.type === 'diagnostic' && audit.score !== null)
        .map((audit: any) => ({
          id: audit.id,
          title: audit.title,
          description: audit.description,
          score: audit.score ? Math.round(audit.score * 100) : null,
          numericValue: audit.numericValue,
          displayValue: audit.displayValue,
        }))
        .slice(0, 10), // 只返回前 10 个诊断信息
    };

    return simplifiedReport;
  }
}

