import { defaultOptions } from '@/interface/constant';
import { LayoutOptions } from '@/interface/definition';

export const getGutter = (gutter: LayoutOptions['gutter'], key: 'row' | 'col' = 'row'): number => {
  gutter = gutter || defaultOptions.gutter || 0;

  if (typeof gutter === 'number') {
    return gutter;
  }

  return gutter[key];
};
