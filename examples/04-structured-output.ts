import { VisionAI } from "vision-universal-ai";

interface ProductCatalogItem {
  id: string;
  name: string;
  category: string;
  price: number;
  tags: string[];
  inStock: boolean;
}

async function main() {
  console.log("=== Vision Universal AI - Structured JSON Outputs ===\n");

  const ai = new VisionAI({
    provider: "gemini",
    apiKey: process.env.GEMINI_API_KEY
  });

  const result = await ai.generate<ProductCatalogItem>({
    prompt: "Generate a futuristic cybersecurity product for space stations.",
    responseFormat: {
      type: "json",
      schema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          price: { type: "number" },
          tags: {
            type: "array",
            items: { type: "string" }
          },
          inStock: { type: "boolean" }
        },
        required: ["id", "name", "category", "price", "tags", "inStock"]
      }
    }
  });

  console.log("Strictly Typed Parsed Object:");
  console.log("Product Name:", result.data.name);
  console.log("Price (USD):", result.data.price);
  console.log("Tags:", result.data.tags.join(", "));
  console.log("\nFull Raw JSON:", JSON.stringify(result.data, null, 2));
}

main().catch(console.error);
