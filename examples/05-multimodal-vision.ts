import { VisionAI } from "vision-universal-ai";

async function main() {
  console.log("=== Vision Universal AI - Multimodal Image Analysis ===\n");

  const ai = new VisionAI({
    provider: "gemini",
    apiKey: process.env.GEMINI_API_KEY
  });

  // Example 1: Image URL analysis
  const responseFromUrl = await ai.chat({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe what is depicted in this image and its dominant colors."
          },
          {
            type: "image",
            image: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400"
          }
        ]
      }
    ]
  });

  console.log("[Analysis from URL]:", responseFromUrl.text);

  // Example 2: Inline Base64 image analysis
  // 1x1 transparent PNG sample in base64
  const sampleBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  const responseFromBase64 = await ai.chat({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "What is this image?" },
          { type: "image", image: sampleBase64, mimeType: "image/png" }
        ]
      }
    ]
  });

  console.log("[Analysis from Base64]:", responseFromBase64.text);
}

main().catch(console.error);
