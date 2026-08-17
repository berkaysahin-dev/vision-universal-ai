import { VisionAI, type AITool } from "vision-universal-ai";

// Define executable tools
const weatherTool: AITool<{ city: string }> = {
  name: "get_weather",
  description: "Get real-time weather information for a specific city.",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "The name of the city" }
    },
    required: ["city"]
  },
  execute: async ({ city }) => {
    console.log(`  [Executing Tool get_weather] Looking up forecast for: ${city}...`);
    return {
      city,
      temperature: 24,
      condition: "Sunny with mild breeze",
      humidity: "45%"
    };
  }
};

const stockTool: AITool<{ ticker: string }> = {
  name: "get_stock_price",
  description: "Get current stock price and change percentage.",
  parameters: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "The stock ticker symbol (e.g. GOOG, AAPL)" }
    },
    required: ["ticker"]
  },
  execute: async ({ ticker }) => {
    console.log(`  [Executing Tool get_stock_price] Looking up ticker: ${ticker}...`);
    return {
      ticker: ticker.toUpperCase(),
      price: "$182.50",
      change: "+2.4%"
    };
  }
};

async function main() {
  console.log("=== Vision Universal AI - Autonomous Multi-Step Tool Calling ===\n");

  const ai = new VisionAI({
    provider: "gemini",
    apiKey: process.env.GEMINI_API_KEY
  });

  const response = await ai.chat({
    prompt: "What is the weather in Tokyo and what is the current price of GOOG stock?",
    tools: [weatherTool, stockTool]
  });

  console.log("\n[Final Answer from AI]:");
  console.log(response.text);
}

main().catch(console.error);
