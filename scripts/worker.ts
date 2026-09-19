import { maintenance } from "../src/server/worker";
function tick() {
  try {
    const result = maintenance();
    console.log(
      new Date().toISOString(),
      "Maintenance completed; events:",
      result.processed,
    );
  } catch (error) {
    console.error(
      "Maintenance failed:",
      error instanceof Error ? error.name : "unknown",
    );
  }
}
tick();
const interval = setInterval(tick, 60000);
process.on("SIGINT", () => {
  clearInterval(interval);
  process.exit(0);
});
process.on("SIGTERM", () => {
  clearInterval(interval);
  process.exit(0);
});
