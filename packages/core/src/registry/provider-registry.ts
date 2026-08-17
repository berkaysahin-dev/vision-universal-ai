import type { AIProvider } from "../types/provider.js";

/**
 * Registry holding AIProvider adaptor instances
 */
export class ProviderRegistry {
  private providers = new Map<string, AIProvider>();

  /**
   * Registers a provider instance
   */
  public register(provider: AIProvider): this {
    this.providers.set(provider.name.toLowerCase(), provider);
    return this;
  }

  /**
   * Retrieves a registered provider by name
   */
  public get(name: string): AIProvider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  /**
   * Checks if a provider is registered
   */
  public has(name: string): boolean {
    return this.providers.has(name.toLowerCase());
  }

  /**
   * Returns list of all registered provider instances
   */
  public list(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Returns list of registered provider names
   */
  public getNames(): string[] {
    return Array.from(this.providers.keys());
  }
}

/**
 * Global default singleton registry
 */
export const defaultRegistry = new ProviderRegistry();
