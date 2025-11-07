import { safeStorage } from '@sider/utils/safeStorage';
import { createUseStorageState } from './createUseStorageState';

const isBrowser = typeof window !== 'undefined';

export const useLocalStorageState: ReturnType<typeof createUseStorageState> =
  createUseStorageState(() => (isBrowser ? safeStorage : undefined));
