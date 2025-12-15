import { Page } from 'puppeteer';
import { ElementState, CheckElementParams } from '../types.js';
import { BrowserManager } from '../browser-manager.js';

/**
 * 元素状态检查器
 */
export class ElementHandler {
  private browserManager: BrowserManager;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * 检查元素状态
   */
  public async checkElement(
    params: CheckElementParams
  ): Promise<ElementState | null> {
    const page = await this.browserManager.getPage(params.url);

    try {
      // 等待元素出现
      await page.waitForSelector(params.selector, { timeout: 5000 });
    } catch (error) {
      // 元素不存在或超时
      return null;
    }

    // 获取元素信息
    const elementState = await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);

      // 获取所有属性
      const attributes: Record<string, string> = {};
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attributes[attr.name] = attr.value;
      }

      // 获取所有样式
      const computedStyles: Record<string, string> = {};
      for (let i = 0; i < styles.length; i++) {
        const property = styles[i];
        computedStyles[property] = styles.getPropertyValue(property);
      }

      // 检查是否可见
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        styles.display !== 'none' &&
        styles.visibility !== 'hidden' &&
        styles.opacity !== '0';

      // 检查是否可点击（简化判断）
      const clickable =
        visible &&
        styles.pointerEvents !== 'none' &&
        styles.cursor !== 'not-allowed';

      return {
        tagName: element.tagName.toLowerCase(),
        id: element.id || undefined,
        className: element.className || undefined,
        textContent: element.textContent?.trim().substring(0, 200) || undefined,
        innerHTML: element.innerHTML.substring(0, 500) || undefined,
        attributes,
        styles: computedStyles,
        visible,
        clickable,
        boundingBox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
      };
    }, params.selector);

    if (!elementState) {
      return null;
    }

    return elementState as ElementState;
  }

  /**
   * 检查多个元素
   */
  public async checkElements(
    selectors: string[],
    url?: string
  ): Promise<Record<string, ElementState | null>> {
    const results: Record<string, ElementState | null> = {};

    for (const selector of selectors) {
      results[selector] = await this.checkElement({ selector, url });
    }

    return results;
  }

  /**
   * 获取元素的 CDP 节点 ID
   */
  private async getNodeId(
    page: Page,
    selector: string
  ): Promise<number | null> {
    try {
      const client = await page.target().createCDPSession();
      const { root } = await client.send('DOM.getDocument');
      const { nodeId } = await client.send('DOM.querySelector', {
        nodeId: root.nodeId,
        selector,
      });
      return nodeId;
    } catch {
      return null;
    }
  }
}

