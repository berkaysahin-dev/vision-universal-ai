#!/usr/bin/env node
import { runCLI } from "../dist/index.js";

runCLI(process.argv.slice(2)).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
