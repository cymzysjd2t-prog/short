import { runStickPipeline } from "./stick-pipeline.js";

runStickPipeline().catch((err) => {
  console.error("Échec du pipeline stickman :", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
