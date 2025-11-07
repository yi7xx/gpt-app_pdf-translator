/**
 * 用户可能禁用了 localStorage，需要 polyfill
 * 使用SafeLocalStorage，防止白屏等问题
 */
export class SafeLocalStorage implements Storage {
  private static valuesMap = new Map<string, string>();

  private static protectedKeys = [
    'getItem',
    'setItem',
    'key',
    'removeItem',
    'clear',
    'length',
  ];

  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      const stringKey = String(key);
      return SafeLocalStorage.valuesMap.has(stringKey)
        ? String(SafeLocalStorage.valuesMap.get(stringKey))
        : null;
    }
  }

  setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      SafeLocalStorage.valuesMap.set(String(key), String(value));
    }
  }

  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      if (!SafeLocalStorage.protectedKeys.includes(key)) {
        SafeLocalStorage.valuesMap.delete(key);
      }
    }
  }

  clear() {
    try {
      window.localStorage.clear();
    } catch {
      const keys = Array.from(SafeLocalStorage.valuesMap.keys()).filter(
        (k) => !SafeLocalStorage.protectedKeys.includes(k),
      );

      keys.forEach((k) => {
        SafeLocalStorage.valuesMap.delete(k);
      });
    }
  }

  key(index: number): string | null {
    try {
      return window.localStorage.key(index);
    } catch {
      const keys = Array.from(SafeLocalStorage.valuesMap.keys()).filter(
        (k) => !SafeLocalStorage.protectedKeys.includes(k),
      );
      return keys[index] || null;
    }
  }

  get length() {
    try {
      return window.localStorage.length;
    } catch {
      return Array.from(SafeLocalStorage.valuesMap.keys()).filter(
        (k) => !SafeLocalStorage.protectedKeys.includes(k),
      ).length;
    }
  }
}

const instance = new SafeLocalStorage();

export const safeStorage = new Proxy(instance, {
  set: function (obj, prop, value) {
    if (!(prop in SafeLocalStorage.prototype)) {
      obj.setItem(prop as string, value);
    }
    return true;
  },
  get: function (target, name) {
    if (SafeLocalStorage.prototype.hasOwnProperty(name)) {
      return target[name as keyof typeof target];
    }
    return target.getItem(name as string);
  },
});
