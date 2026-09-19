export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { maintenance } = await import("./server/worker");
  const state = globalThis as typeof globalThis & {
    deskHopMaintenance?: ReturnType<typeof setInterval>;
  };
  if (state.deskHopMaintenance) return;
  const tick = () => {
    try {
      maintenance();
    } catch (error) {
      console.error("DeskHop maintenance failed", {
        errorType: error instanceof Error ? error.name : "unknown",
      });
    }
  };
  tick();
  state.deskHopMaintenance = setInterval(tick, 60000);
  state.deskHopMaintenance.unref();
}
