import { describe, it, expect } from "vitest";
import { VisionAI, CapabilityNotSupportedError } from "vision-universal-ai";
import { MockProvider } from "../fixtures/mock-provider.js";

describe("Unsupported Capability Error Handling", () => {
  it("should throw CapabilityNotSupportedError when invoking embed on a provider without embeddings", async () => {
    const textOnlyMock = new MockProvider("text-only-bot");
    // disable embeddings capability
    textOnlyMock.capabilities.embeddings = false;
    textOnlyMock.embed = undefined;

    const ai = new VisionAI({
      provider: "text-only-bot",
      providers: [textOnlyMock]
    });

    await expect(ai.embed({ input: "test query" })).rejects.toThrow(CapabilityNotSupportedError);
  });

  it("should throw CapabilityNotSupportedError when invoking generateImage on an unsupported provider", async () => {
    const noImageMock = new MockProvider("no-image-bot");
    noImageMock.capabilities.imageGeneration = false;
    noImageMock.generateImage = undefined;

    const ai = new VisionAI({
      provider: "no-image-bot",
      providers: [noImageMock]
    });

    await expect(ai.generateImage({ prompt: "cyberpunk skyline" })).rejects.toThrow(CapabilityNotSupportedError);
  });
});
