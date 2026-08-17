import { VisionAI } from "vision-universal-ai";

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
  console.log("=== Vision Universal AI - Embeddings & Semantic Similarity ===\n");

  const ai = new VisionAI({
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY
  });

  const query = "Artificial intelligence in modern medicine";
  const documents = [
    "Machine learning algorithms assist doctors in detecting cancer early.",
    "Baking chocolate chip cookies with organic butter and brown sugar.",
    "Neural network diagnostic systems for radiology imaging."
  ];

  console.log(`Query: "${query}"\nGenerating embeddings...`);

  const queryEmbeddingRes = await ai.embed({ input: query });
  const queryVec = queryEmbeddingRes.embeddings[0];

  const docEmbeddingRes = await ai.embed({ input: documents });

  console.log("\nSemantic Similarity Scores:");
  documents.forEach((doc, idx) => {
    const docVec = docEmbeddingRes.embeddings[idx];
    const score = cosineSimilarity(queryVec, docVec);
    console.log(`  [Score: ${(score * 100).toFixed(2)}%] "${doc}"`);
  });
}

main().catch(console.error);
