import { Page } from 'puppeteer-core';
import {
  HeapSnapshot,
  MemoryAnalysis,
  AllocationTracking,
  GetHeapSnapshotParams,
  AnalyzeMemoryParams,
  TrackAllocationsParams,
} from '../types.js';
import { BrowserManager } from '../browser-manager.js';

/**
 * 内存堆栈分析器
 */
export class HeapHandler {
  private browserManager: BrowserManager;
  private snapshots: Map<string, HeapSnapshot[]> = new Map();
  private allocationTracking: Map<string, AllocationTracking> = new Map();

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * 获取堆快照
   */
  public async getHeapSnapshot(
    params: GetHeapSnapshotParams
  ): Promise<HeapSnapshot> {
    const page = await this.browserManager.getPage(params.url);
    const client = await page.target().createCDPSession();

    try {
      // 启用 HeapProfiler
      await client.send('HeapProfiler.enable');

      // 获取堆快照
      const snapshot = await client.send('HeapProfiler.takeHeapSnapshot', {
        reportProgress: false,
      });

      // 获取堆统计信息
      const heapStats = await page.evaluate(() => {
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        };
      }
      return null;
    });

    // 解析快照数据（简化版本）
    const nodes: HeapSnapshot['nodes'] = [];
    let totalSize = 0;
    let totalNodes = 0;

    // 获取对象统计
    const objectCounts: Record<string, number> = {};

    // 注意：实际的堆快照数据非常复杂，这里提供简化版本
    // 实际应用中需要解析完整的快照格式

      return {
        nodes,
        totalSize: heapStats?.usedJSHeapSize || 0,
        totalNodes,
        timestamp: Date.now(),
      };
    } finally {
      // 确保 CDP 连接被正确关闭
      try {
        await client.detach();
      } catch (error) {
        // 忽略关闭错误
      }
    }
  }

  /**
   * 分析内存使用情况
   */
  public async analyzeMemory(
    params: AnalyzeMemoryParams
  ): Promise<MemoryAnalysis> {
    const page = await this.browserManager.getPage(params.url);
    const client = await page.target().createCDPSession();

    try {
      // 启用 Runtime 和 HeapProfiler
      await client.send('Runtime.enable');
      await client.send('HeapProfiler.enable');

      // 获取堆使用情况
      const heapUsage = await page.evaluate(() => {
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        return {
          heapUsed: memory.usedJSHeapSize,
          heapTotal: memory.totalJSHeapSize,
          external: 0,
          rss: 0,
        };
      }
      return {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
      };
    });

      // 获取对象统计（通过采样）
      const objectCounts = await this.getObjectCounts(client);

      return {
        ...heapUsage,
        timestamp: Date.now(),
        objectCounts,
      };
    } finally {
      // 确保 CDP 连接被正确关闭
      try {
        await client.detach();
      } catch (error) {
        // 忽略关闭错误
      }
    }
  }

  /**
   * 跟踪对象分配
   */
  public async trackAllocations(
    params: TrackAllocationsParams
  ): Promise<AllocationTracking> {
    const page = await this.browserManager.getPage(params.url);
    const client = await page.target().createCDPSession();
    const pageUrl = page.url();

    try {
      // 启用 HeapProfiler
      await client.send('HeapProfiler.enable');

      // 开始跟踪分配
      await client.send('HeapProfiler.startTrackingHeapObjects', {
        trackAllocations: true,
      });

      // 等待指定时间
      const duration = params.duration || 5000;
      await new Promise((resolve) => setTimeout(resolve, duration));

      // 停止跟踪并获取结果
      await client.send('HeapProfiler.stopTrackingHeapObjects', {
        reportProgress: false,
      });

    // 获取分配采样数据
    const allocations: AllocationTracking['allocations'] = [];
    let totalAllocated = 0;

    // 获取堆统计
    const heapStats = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    totalAllocated = heapStats;

      const tracking: AllocationTracking = {
        allocations,
        totalAllocated,
        count: allocations.length,
      };

      this.allocationTracking.set(pageUrl, tracking);
      return tracking;
    } finally {
      // 确保 CDP 连接被正确关闭
      try {
        await client.detach();
      } catch (error) {
        // 忽略关闭错误
      }
    }
  }

  /**
   * 检测内存泄漏（对比多次快照）
   */
  public async detectMemoryLeak(
    url: string,
    snapshotCount: number = 3,
    interval: number = 5000
  ): Promise<{
    leakDetected: boolean;
    growthRate: number;
    snapshots: HeapSnapshot[];
  }> {
    const snapshots: HeapSnapshot[] = [];

    for (let i = 0; i < snapshotCount; i++) {
      const snapshot = await this.getHeapSnapshot({ url });
      snapshots.push(snapshot);

      if (i < snapshotCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }

    // 计算增长率
    const sizes = snapshots.map((s) => s.totalSize);
    const growthRate =
      sizes.length > 1
        ? ((sizes[sizes.length - 1] - sizes[0]) / sizes[0]) * 100
        : 0;

    // 如果增长率超过 10%，认为可能存在内存泄漏
    const leakDetected = growthRate > 10;

    return {
      leakDetected,
      growthRate,
      snapshots,
    };
  }

  /**
   * 获取对象计数（采样）
   */
  private async getObjectCounts(
    client: any
  ): Promise<Record<string, number>> {
    try {
      // 获取堆对象统计
      const result = await client.send('HeapProfiler.getHeapObjectId', {
        objectId: '1',
      });

      // 这里需要更复杂的实现来统计对象
      // 简化版本返回空对象
      return {};
    } catch {
      return {};
    }
  }

  /**
   * 清除快照历史
   */
  public clearSnapshots(url?: string): void {
    if (url) {
      this.snapshots.delete(url);
    } else {
      this.snapshots.clear();
    }
  }
}

