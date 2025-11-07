import { getVisibleElements } from './ui_utils';

export class DOMSVGFactory {
  create(width: any, height: any, skipDimensions?: boolean): any;
  createElement(type: any): any;
}

export type VisibleElements<
  T extends { id: number; div: HTMLElement; renderingState: RenderingStates },
> = ReturnType<typeof getVisibleElements<T>>;
