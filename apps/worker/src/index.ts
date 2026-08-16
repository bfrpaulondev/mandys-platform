const shutdown = (signal: string) => {
  console.info(`[mandys-worker] ${signal} received`);
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.info("[mandys-worker] ready; queue adapters will be introduced with the first asynchronous workflow");
