import type { PageViewport } from 'pdfjs-dist';
import { FeatureTest } from './util';

/**
 * 一个用于定义和计算不同场景下像素密度值的工具类。
 * 参考：https://github.com/mozilla/pdf.js/blob/master/src/display/display_utils.js
 */
export class PixelsPerInch {
  /**
   * CSS 的标准像素每英寸（PPI）值。
   * 这是 Web 开发中广泛接受的标准值。
   */
  static CSS = 96.0;

  /**
   * PDF 文档的标准像素每英寸（PPI）值。
   * 这是打印和 PDF 渲染中常用的标准值。
   */
  static PDF = 72.0;

  /**
   * 从 PDF 单位转换为 CSS 单位的转换因子。
   * 通过 CSS PPI 与 PDF PPI 的比值计算得出。
   */
  static PDF_TO_CSS_UNITS = this.CSS / this.PDF;
}

/**
 * 输出缩放
 */
export class OutputScale {
  // 水平缩放
  public sx: number;
  // 垂直缩放
  public sy: number;
  constructor() {
    const pixelRatio = window.devicePixelRatio || 1;
    this.sx = pixelRatio;
    this.sy = pixelRatio;
  }

  get scaled() {
    return this.sx !== 1 || this.sy !== 1;
  }

  get symmetric() {
    return this.sx === this.sy;
  }
}

/**
 * 设置图层尺寸
 */
export const setLayerDimensions = (
  div: HTMLDivElement,
  viewport: PageViewport,
  mustFlip = false,
  mustRotate = true
) => {
  const { pageWidth, pageHeight } = viewport.rawDims as {
    pageWidth: number;
    pageHeight: number;
  };
  const { style } = div;
  const useRound = FeatureTest.isCSSRoundSupported;

  const w = `var(--scale-factor) * ${pageWidth}px`,
    h = `var(--scale-factor) * ${pageHeight}px`;
  const widthStr = useRound
      ? `round(down, ${w}, var(--scale-round-x, 1px))`
      : `calc(${w})`,
    heightStr = useRound
      ? `round(down, ${h}, var(--scale-round-y, 1px))`
      : `calc(${h})`;

  if (!mustFlip || viewport.rotation % 180 === 0) {
    style.width = widthStr;
    style.height = heightStr;
  } else {
    style.width = heightStr;
    style.height = widthStr;
  }

  if (mustRotate) {
    div.setAttribute('data-main-rotation', `${viewport.rotation}`);
  }
};

/**
 * 获取颜色值的 RGB 值
 * @param color 颜色值
 * @returns RGB 值
 */
export const getRGB = (color: string) => {
  if (color.startsWith('#')) {
    const colorRGB = parseInt(color.slice(1), 16);
    return [
      (colorRGB & 0xff0000) >> 16,
      (colorRGB & 0x00ff00) >> 8,
      colorRGB & 0x0000ff,
    ];
  }

  if (color.startsWith('rgb(')) {
    // getComputedStyle(...).color returns a `rgb(R, G, B)` color.
    return color
      .slice(/* "rgb(".length */ 4, -1) // Strip out "rgb(" and ")".
      .split(',')
      .map(x => parseInt(x));
  }

  if (color.startsWith('rgba(')) {
    return color
      .slice(/* "rgba(".length */ 5, -1) // Strip out "rgba(" and ")".
      .split(',')
      .map(x => parseInt(x))
      .slice(0, 3);
  }

  console.warn(`Not a valid color format: "${color}"`);
  return [0, 0, 0];
};
