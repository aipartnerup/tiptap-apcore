import type { Registry, ModuleDescriptor } from "../types.js";

/**
 * TiptapRegistry implements the APCore Registry interface.
 *
 * Manages module descriptors with event-driven registration/unregistration
 * and supports filtering by tags (OR logic) and/or prefix (startsWith).
 */
export class TiptapRegistry implements Registry {
  private modules: Map<string, ModuleDescriptor> = new Map();
  private handlers: Map<string, Array<(...args: unknown[]) => void>> =
    new Map();
  private scanFn: (() => number | Promise<number>) | null = null;

  register(descriptor: ModuleDescriptor): void {
    this.modules.set(descriptor.moduleId, descriptor);
    this.emit("register", descriptor.moduleId, descriptor);
  }

  unregister(moduleId: string): void {
    this.modules.delete(moduleId);
    this.emit("unregister", moduleId);
  }

  list(options?: { tags?: string[] | null; prefix?: string | null }): string[] {
    let ids = Array.from(this.modules.keys());

    if (!options) {
      return ids;
    }

    const { tags, prefix } = options;

    if (tags && tags.length > 0) {
      ids = ids.filter((id) => {
        const descriptor = this.modules.get(id)!;
        const moduleTags = descriptor.tags ?? [];
        // OR logic: module matches if it has ANY of the requested tags
        return tags.some((tag) => moduleTags.includes(tag));
      });
    }

    if (prefix) {
      ids = ids.filter((id) => id.startsWith(prefix));
    }

    return ids;
  }

  getDefinition(moduleId: string): ModuleDescriptor | null {
    return this.modules.get(moduleId) ?? null;
  }

  has(moduleId: string): boolean {
    return this.modules.has(moduleId);
  }

  /** Returns an iterator over [moduleId, descriptor] pairs. */
  iter(): IterableIterator<[string, ModuleDescriptor]> {
    return this.modules.entries();
  }

  /** Number of registered modules. */
  get count(): number {
    return this.modules.size;
  }

  /** Array of all registered module IDs. */
  get moduleIds(): string[] {
    return Array.from(this.modules.keys());
  }

  /** Clears any internal caches (no-op for now, reserved for future use). */
  clearCache(): void {
    // TiptapRegistry has no caches currently; method provided for API parity
    // with apcore-js Registry.
  }

  on(event: string, callback: (...args: unknown[]) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const callbacks = this.handlers.get(event);
    if (!callbacks) return;
    const idx = callbacks.indexOf(callback);
    if (idx !== -1) callbacks.splice(idx, 1);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  async discover(): Promise<number> {
    if (this.scanFn) {
      return this.scanFn();
    }
    return this.modules.size;
  }

  setScanFunction(fn: () => number | Promise<number>): void {
    this.scanFn = fn;
  }

  private emit(event: string, ...args: unknown[]): void {
    const callbacks = this.handlers.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(...args));
    }
  }
}
