/* Copyright 2015 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export class DOMSVGFactory {
  create(width: any, height: any, skipDimensions: boolean = false): any {
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid SVG dimensions');
    }
    const svg = this.createSVG('svg');
    svg.setAttribute('version', '1.1');

    if (!skipDimensions) {
      svg.setAttribute('width', `${width}px`);
      svg.setAttribute('height', `${height}px`);
    }

    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    return svg;
  }

  createElement(type: any): any {
    if (typeof type !== 'string') {
      throw new Error('Invalid SVG element type');
    }
    return this.createSVG(type);
  }

  private createSVG(type: any) {
    return document.createElementNS(SVG_NS, type);
  }
}
