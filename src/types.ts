import { Page } from 'puppeteer-core';

/**
 * 浏览器配置选项
 */
export interface BrowserConfig {
  headless?: boolean;
  args?: string[];
  timeout?: number;
}

/**
 * 页面信息
 */
export interface PageInfo {
  page: Page;
  url: string;
  createdAt: Date;
}

/**
 * Console 日志条目
 */
export interface ConsoleLogEntry {
  type: 'log' | 'error' | 'warning' | 'info' | 'debug';
  text: string;
  timestamp: number;
  stackTrace?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}

/**
 * 元素状态信息
 */
export interface ElementState {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  innerHTML?: string;
  attributes: Record<string, string>;
  styles: Record<string, string>;
  visible: boolean;
  clickable: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * 缓存状态信息
 */
export interface CacheStatus {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: string;
  }>;
  indexedDB?: {
    databases: string[];
  };
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  navigation: {
    type: string;
    redirectCount: number;
    timing: {
      navigationStart: number;
      unloadEventStart?: number;
      unloadEventEnd?: number;
      redirectStart?: number;
      redirectEnd?: number;
      fetchStart: number;
      domainLookupStart?: number;
      domainLookupEnd?: number;
      connectStart?: number;
      connectEnd?: number;
      secureConnectionStart?: number;
      requestStart?: number;
      responseStart?: number;
      responseEnd?: number;
      domLoading?: number;
      domInteractive?: number;
      domContentLoadedEventStart?: number;
      domContentLoadedEventEnd?: number;
      domComplete?: number;
      loadEventStart?: number;
      loadEventEnd?: number;
    };
  };
  paint: Array<{
    name: string;
    entryType: string;
    startTime: number;
    duration: number;
  }>;
  resources: Array<{
    name: string;
    entryType: string;
    startTime: number;
    duration: number;
    initiatorType: string;
    transferSize: number;
    encodedBodySize: number;
    decodedBodySize: number;
  }>;
  marks: Array<{
    name: string;
    entryType: string;
    startTime: number;
  }>;
  measures: Array<{
    name: string;
    entryType: string;
    startTime: number;
    duration: number;
  }>;
}

/**
 * 堆快照节点
 */
export interface HeapSnapshotNode {
  id: number;
  name: string;
  type: string;
  size: number;
  distance?: number;
}

/**
 * 堆快照信息
 */
export interface HeapSnapshot {
  nodes: HeapSnapshotNode[];
  totalSize: number;
  totalNodes: number;
  timestamp: number;
}

/**
 * 内存分析结果
 */
export interface MemoryAnalysis {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  timestamp: number;
  objectCounts?: Record<string, number>;
}

/**
 * 分配跟踪信息
 */
export interface AllocationTracking {
  allocations: Array<{
    size: number;
    timestamp: number;
    stackTrace?: string[];
  }>;
  totalAllocated: number;
  count: number;
}

/**
 * 工具参数类型
 */
export interface NavigateParams {
  url: string;
}

export interface GetConsoleErrorsParams {
  url?: string;
  level?: 'error' | 'warning' | 'all';
}

export interface CheckElementParams {
  selector: string;
  url?: string;
}

export interface GetCacheStatusParams {
  url?: string;
}

export interface GetPerformanceParams {
  url?: string;
}

export interface GetHeapSnapshotParams {
  url?: string;
}

export interface AnalyzeMemoryParams {
  url?: string;
}

export interface TrackAllocationsParams {
  url?: string;
  duration?: number;
}

export interface TakeScreenshotParams {
  url?: string;
  fullPage?: boolean;
}

