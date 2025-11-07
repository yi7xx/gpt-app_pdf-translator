/**
 * 注意：以下导出的模块是基于 pdfjs-dist 的内部实现。
 * 这些模块可能在未来版本中发生变化或被移除，请谨慎依赖。
 * 如果 pdfjs-dist 升级，请务必检查相关内部模块的兼容性。
 */

import { HighlightOutliner } from './editor/drawers/highlight.js';
import { DOMSVGFactory } from './svg_factory';
import type { VisibleElements } from './type.js';
import { getVisibleElements } from './ui_utils';

const HighlightOutlinerInternal = HighlightOutliner;

const DOMSVGFactoryInternal = DOMSVGFactory;

export type HighlightOutline = ReturnType<HighlightOutliner['getOutlines']>;

// pdfjs-dist 内部模块
export { HighlightOutlinerInternal, DOMSVGFactoryInternal, getVisibleElements };

export type { VisibleElements };

export * from './pdf_find_controller';
export * from './pdf_find_utils';
