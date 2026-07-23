import { runPipeline } from "./pipeline.js";

runPipeline().catch((err) => {
  console.error("Échec du pipeline :", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
