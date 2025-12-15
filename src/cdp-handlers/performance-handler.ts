import { Page } from 'puppeteer';
import { PerformanceMetrics, GetPerformanceParams } from '../types.js';
import { BrowserManager } from '../browser-manager.js';

/**
 * 性能数据收集器
 */
export class PerformanceHandler {
  private browserManager: BrowserManager;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * 获取性能数据
   */
  public async getPerformance(
    params: GetPerformanceParams
  ): Promise<PerformanceMetrics> {
    const page = await this.browserManager.getPage(params.url);

    // 启用 Performance 域
    const client = await page.target().createCDPSession();
    await client.send('Performance.enable');

    // 获取性能指标
    const performanceData = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      const resources = performance.getEntriesByType(
        'resource'
      ) as PerformanceResourceTiming[];
      const marks = performance.getEntriesByType('mark');
      const measures = performance.getEntriesByType('measure');

      return {
        navigation: {
          type: navigation.type.toString(),
          redirectCount: navigation.redirectCount,
          timing: {
            navigationStart: navigation.startTime, // navigationStart does not exist, use startTime
            unloadEventStart: navigation.unloadEventStart,
            unloadEventEnd: navigation.unloadEventEnd,
            redirectStart: navigation.redirectStart,
            redirectEnd: navigation.redirectEnd,
            fetchStart: navigation.fetchStart,
            domainLookupStart: navigation.domainLookupStart,
            domainLookupEnd: navigation.domainLookupEnd,
            connectStart: navigation.connectStart,
            connectEnd: navigation.connectEnd,
            secureConnectionStart: navigation.secureConnectionStart,
            requestStart: navigation.requestStart,
            responseStart: navigation.responseStart,
            responseEnd: navigation.responseEnd,
            // domLoading is not available on PerformanceNavigationTiming, so we omit it
            domInteractive: navigation.domInteractive,
            domContentLoadedEventStart: navigation.domContentLoadedEventStart,
            domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
            domComplete: navigation.domComplete,
            loadEventStart: navigation.loadEventStart,
            loadEventEnd: navigation.loadEventEnd,
          },
        },
        paint: paint.map((entry) => ({
          name: entry.name,
          entryType: entry.entryType,
          startTime: entry.startTime,
          duration: entry.duration,
        })),
        resources: resources.map((entry) => ({
          name: entry.name,
          entryType: entry.entryType,
          startTime: entry.startTime,
          duration: entry.duration,
          initiatorType: entry.initiatorType,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
        })),
        marks: marks.map((entry) => ({
          name: entry.name,
          entryType: entry.entryType,
          startTime: entry.startTime,
        })),
        measures: measures.map((entry) => ({
          name: entry.name,
          entryType: entry.entryType,
          startTime: entry.startTime,
          duration: entry.duration,
        })),
      };
    });

    // 获取 Performance Timeline 数据
    const timeline = await client.send('Performance.getMetrics');

    return performanceData as PerformanceMetrics;
  }

  /**
   * 获取简化的性能指标
   */
  public async getPerformanceSummary(
    params: GetPerformanceParams
  ): Promise<{
    loadTime: number;
    domContentLoaded: number;
    firstPaint?: number;
    firstContentfulPaint?: number;
    resourceCount: number;
    totalTransferSize: number;
  }> {
    const metrics = await this.getPerformance(params);

    const firstPaint = metrics.paint.find((p) => p.name === 'first-paint');
    const firstContentfulPaint = metrics.paint.find(
      (p) => p.name === 'first-contentful-paint'
    );

    const totalTransferSize = metrics.resources.reduce(
      (sum, resource) => sum + resource.transferSize,
      0
    );

    return {
      loadTime:
        (metrics.navigation.timing.loadEventEnd ||
          metrics.navigation.timing.domComplete ||
          0) - metrics.navigation.timing.navigationStart,
      domContentLoaded:
        (metrics.navigation.timing.domContentLoadedEventEnd ||
          metrics.navigation.timing.domInteractive ||
          0) - metrics.navigation.timing.navigationStart,
      firstPaint: firstPaint?.startTime,
      firstContentfulPaint: firstContentfulPaint?.startTime,
      resourceCount: metrics.resources.length,
      totalTransferSize,
    };
  }
}

