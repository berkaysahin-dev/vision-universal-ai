import { VisionAI } from "./packages/sdk/dist/index.js";

// Self-contained demo mock provider
class DemoProvider {
  constructor(name, behavior = {}) {
    this.name = name;
    this.displayName = name.toUpperCase();
    this.defaultModel = `${name}-model-v1`;
    this.behavior = behavior;
    this.capabilities = {
      chat: true,
      stream: true,
      tools: true,
      vision: true,
      audioInput: true,
      pdfInput: true,
      jsonSchema: true,
      embeddings: true,
      imageGeneration: true,
      speechToText: true,
      textToSpeech: true
    };
  }

  async chat(options) {
    if (this.behavior.throwError) {
      throw this.behavior.throwError;
    }
    return {
      text: this.behavior.responseText || `Response from ${this.name}`,
      toolCalls: this.behavior.toolCalls,
      finishReason: "stop",
      usage: { promptTokens: 12, completionTokens: 24, totalTokens: 36 },
      provider: this.name,
      model: options.model || this.defaultModel
    };
  }

  async *stream(options) {
    if (this.behavior.throwError) {
      throw this.behavior.throwError;
    }
    const chunks = this.behavior.chunks || ["Vision", " Universal", " AI", " streaming", " aktif!"];
    let acc = "";
    for (const chunk of chunks) {
      acc += chunk;
      yield { text: acc, delta: chunk, finishReason: "stop" };
    }
  }
}

// Colorful console formatting
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const magenta = (text) => `\x1b[35m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;

console.log(`
${cyan("╔════════════════════════════════════════════════════════════════╗")}
${cyan("║")}   ${bold(magenta("🌌 VISION UNIVERSAL AI"))}  —  ${yellow('"One SDK. Every AI."')}          ${cyan("║")}
${cyan("╚════════════════════════════════════════════════════════════════╝")}
`);

async function runDemo() {
  // 1. Unified Client Setup & Switching
  console.log(bold("[1/5] 🔄 Unified Provider Abstraction & Swapping"));
  
  const mockGemini = new DemoProvider("gemini", {
    responseText: "Google Gemini 2.0 Flash: Yapay zekada çoklu mod ve ultra düşük gecikme çağı başladı!"
  });
  const mockOpenAI = new DemoProvider("openai", {
    responseText: "OpenAI GPT-4o: Tek API üzerinden tüm provider'lar sorunsuz entegre edildi."
  });
  const mockClaude = new DemoProvider("anthropic", {
    responseText: "Anthropic Claude 3.5 Sonnet: Mükemmel kodlama ve derin akıl yürütme performansı."
  });

  const aiGemini = new VisionAI({
    provider: "gemini",
    providers: [mockGemini, mockOpenAI, mockClaude]
  });

  // Call Gemini
  const res1 = await aiGemini.chat({ prompt: "Merhaba!", model: "gemini-2.0-flash" });
  console.log(`  ${green("✔")} [GEMINI]    ➔ "${res1.text}" (Tokens: ${res1.usage?.totalTokens})`);

  // Switch to OpenAI
  const aiOpenAI = new VisionAI({ provider: "openai", providers: [mockOpenAI] });
  const res2 = await aiOpenAI.chat("Merhaba OpenAI!");
  console.log(`  ${green("✔")} [OPENAI]    ➔ "${res2.text}" (Tokens: ${res2.usage?.totalTokens})`);

  // Switch to Claude
  const aiClaude = new VisionAI({ provider: "anthropic", providers: [mockClaude] });
  const res3 = await aiClaude.chat("Merhaba Claude!");
  console.log(`  ${green("✔")} [ANTHROPIC] ➔ "${res3.text}" (Tokens: ${res3.usage?.totalTokens})`);

  // 2. Real-Time Streaming
  console.log(bold("\n[2/5] ⚡ Real-Time Streaming (AsyncIterable & ReadableStream)"));
  const streamProvider = new DemoProvider("gemini", {
    chunks: ["Vision ", "Universal ", "AI ", "ile ", "gerçek ", "zamanlı ", "hızlı ", "streaming! 🚀"]
  });
  const streamAI = new VisionAI({ provider: "gemini", providers: [streamProvider] });

  process.stdout.write("  " + cyan("Stream:") + " ");
  const stream = await streamAI.stream("Streaming başlat");
  for await (const chunk of stream) {
    process.stdout.write(magenta(chunk.delta));
    await new Promise((r) => setTimeout(r, 60));
  }
  console.log(green("\n  ✔ Akış başarıyla tamamlandı!"));

  // 3. Autonomous Multi-Step Tool Calling
  console.log(bold("\n[3/5] 🛠️ Autonomous Multi-Step Tool Calling (Function Loop)"));
  
  const weatherTool = {
    name: "get_weather",
    description: "Belirtilen şehrin anlık hava durumunu getirir.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string" }
      },
      required: ["city"]
    },
    execute: async ({ city }) => {
      console.log(`    ${yellow("⚡ Tool Çağrıldı:")} get_weather('${city}') ➔ API sorgulanıyor...`);
      return { city, temperature: 26, condition: "Güneşli ve Açık", humidity: "40%" };
    }
  };

  let toolStep = 0;
  const toolProvider = new DemoProvider("openai");
  toolProvider.chat = async () => {
    toolStep++;
    if (toolStep === 1) {
      return {
        text: "",
        toolCalls: [{ id: "call_w1", name: "get_weather", arguments: { city: "İstanbul" } }],
        provider: "openai",
        model: "gpt-4o"
      };
    }
    return {
      text: "İstanbul'da hava şu anda 26°C, güneşli ve açık bir hava hakim.",
      finishReason: "stop",
      provider: "openai",
      model: "gpt-4o"
    };
  };

  const toolAI = new VisionAI({ provider: "openai", providers: [toolProvider] });
  const toolResponse = await toolAI.chat({
    prompt: "İstanbul'da hava nasıl?",
    tools: [weatherTool]
  });

  console.log(`  ${green("✔")} ${bold("Model Nihai Cevabı:")} "${toolResponse.text}"`);

  // 4. Structured JSON Output & Schema Validation
  console.log(bold("\n[4/5] 📐 Strict Structured Output (JSON Schema Validation)"));
  const schemaProvider = new DemoProvider("gemini", {
    responseText: JSON.stringify({
      productName: "Vision Quantum AI Server",
      priceUSD: 14999,
      specs: ["128 H100 GPUs", "Liquid Nitrogen Cooling", "Quantum Cryptography"],
      inStock: true
    })
  });

  const schemaAI = new VisionAI({ provider: "gemini", providers: [schemaProvider] });
  const structuredData = await schemaAI.generate({
    prompt: "Yeni nesil AI sunucusu oluştur",
    responseFormat: {
      type: "json",
      schema: {
        type: "object",
        properties: {
          productName: { type: "string" },
          priceUSD: { type: "number" },
          specs: { type: "array", items: { type: "string" } },
          inStock: { type: "boolean" }
        },
        required: ["productName", "priceUSD", "specs", "inStock"]
      }
    }
  });

  console.log(`  ${green("✔")} ${cyan("Strictly Validated Object:")}`, structuredData.data);

  // 5. Resilient Routing & Fallback on Provider Failure
  console.log(bold("\n[5/5] 🛡️ Resilient Model Routing (Zero-Downtime Fallback)"));
  
  const failingPrimary = new DemoProvider("gemini", {
    throwError: new Error("Rate limit 429: Too Many Requests (Kota aşıldı)")
  });
  const workingSecondary = new DemoProvider("openai", {
    responseText: "Fallback devrede: OpenAI kesintisiz olarak isteği yanıtladı!"
  });

  const resilientAI = new VisionAI({
    providers: [failingPrimary, workingSecondary],
    routing: {
      default: "gemini",
      fallback: ["openai"],
      fallbackOnRateLimit: true,
      onFallback: ({ failedProvider, error, nextProvider }) => {
        console.log(`    ${yellow("⚠️ Failover Uyarısı:")} '${failedProvider}' hata verdi (${error.message}). Otomatik olarak '${nextProvider}' sağlayıcısına geçildi.`);
      }
    }
  });

  const fallbackRes = await resilientAI.chat("Acil görev çalıştır.");
  console.log(`  ${green("✔")} ${bold("Sonuç:")} "${fallbackRes.text}" (${cyan("Aktif Sağlayıcı: " + fallbackRes.provider.toUpperCase())})`);

  console.log(`
${green("╔════════════════════════════════════════════════════════════════╗")}
${green("║")}   ${bold("✨ TÜM TEST VE DEMO MODÜLLERİ BAŞARIYLA ÇALIŞTI! ✨")}       ${green("║")}
${green("║")}   ${yellow("Vision Universal AI SDK: Production Ready & Ready to Ship")}   ${green("║")}
${green("╚════════════════════════════════════════════════════════════════╝")}
`);
}

runDemo().catch(console.error);
