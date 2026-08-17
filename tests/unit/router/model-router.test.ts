import { describe, it, expect, vi } from "vitest";
import { ModelRouter, RateLimitError, ProviderUnavailableError } from "@vision-ai/core";
import { MockProvider } from "../../fixtures/mock-provider.js";

describe("ModelRouter & Fallback Engine", () => {
  it("should use default provider when it succeeds", async () => {
    const primary = new MockProvider("primary", { responseText: "Hello from primary" });
    const fallback = new MockProvider("fallback", { responseText: "Hello from fallback" });

    const providers = new Map([
      ["primary", primary],
      ["fallback", fallback]
    ]);

    const router = new ModelRouter(
      { default: "primary", fallback: ["fallback"] },
      (name) => providers.get(name)
    );

    const res = await router.executeChat(
      { prompt: "Hi" },
      (p, opts) => p.chat(opts)
    );

    expect(res.text).toBe("Hello from primary");
    expect(primary.callCount).toBe(1);
    expect(fallback.callCount).toBe(0);
  });

  it("should failover to fallback provider on RateLimitError", async () => {
    const primary = new MockProvider("primary", {
      throwError: new RateLimitError("Rate limit exceeded")
    });
    const secondary = new MockProvider("secondary", {
      responseText: "Hello from secondary fallback"
    });

    const providers = new Map([
      ["primary", primary],
      ["secondary", secondary]
    ]);

    const onFallback = vi.fn();
    const router = new ModelRouter(
      {
        default: "primary",
        fallback: ["secondary"],
        onFallback
      },
      (name) => providers.get(name)
    );

    const res = await router.executeChat(
      { prompt: "Hi" },
      (p, opts) => p.chat(opts)
    );

    expect(res.text).toBe("Hello from secondary fallback");
    expect(primary.callCount).toBe(1);
    expect(secondary.callCount).toBe(1);
    expect(onFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        failedProvider: "primary",
        nextProvider: "secondary"
      })
    );
  });

  it("should failover through multi-provider chain until success", async () => {
    const p1 = new MockProvider("p1", { throwError: new ProviderUnavailableError("503") });
    const p2 = new MockProvider("p2", { throwError: new RateLimitError("429") });
    const p3 = new MockProvider("p3", { responseText: "Success from P3" });

    const providers = new Map([
      ["p1", p1],
      ["p2", p2],
      ["p3", p3]
    ]);

    const router = new ModelRouter(
      { default: "p1", fallback: ["p2", "p3"] },
      (name) => providers.get(name)
    );

    const res = await router.executeChat(
      { prompt: "Hi" },
      (p, opts) => p.chat(opts)
    );

    expect(res.text).toBe("Success from P3");
    expect(p1.callCount).toBe(1);
    expect(p2.callCount).toBe(1);
    expect(p3.callCount).toBe(1);
  });
});
