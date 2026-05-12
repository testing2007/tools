/**
 * 组件库类型定义
 */

import React from 'react';
import UIShowcase from './components/UIShowcase/Container';

export type UIShowcaseProps = React.ComponentProps<typeof UIShowcase>;

export interface ComponentLibrary {
  UIShowcase: typeof UIShowcase;
}
