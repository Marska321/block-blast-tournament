const failedWrites = new Set<string>();
export function isStorageHealthy(key?: string) { return key ? !failedWrites.has(key) : failedWrites.size === 0; }
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      failedWrites.delete(key);
      return true;
    } catch {
      failedWrites.add(key);
      return false;
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* memory-only play remains available */
    }
  },
};
