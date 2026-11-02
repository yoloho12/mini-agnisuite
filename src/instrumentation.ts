export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const mod = await import("./instrumentation.node");
  if (typeof mod.register === "function") {
    await mod.register();
  }
}
