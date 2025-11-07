/**
 * 功能测试类
 */
export class FeatureTest {
  /**
   * 检查 CSS 是否支持 round(down, 1px)
   */
  static get isCSSRoundSupported() {
    return globalThis.CSS?.supports?.('width: round(1.5px, 1px)')
  }
}
