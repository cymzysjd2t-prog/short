import { runKidsPipeline } from "./kids-pipeline.js";

runKidsPipeline().catch((err) => {
  console.error("Échec du pipeline enfants :", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
