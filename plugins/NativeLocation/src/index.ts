import { registerPlugin } from '@capacitor/core';
import type { NativeLocationPlugin } from './definitions';

const NativeLocation = registerPlugin<NativeLocationPlugin>('NativeLocation', {
  web: () => import('./web').then(m => new m.NativeLocationWeb()),
});

export * from './definitions';
export { NativeLocation };
