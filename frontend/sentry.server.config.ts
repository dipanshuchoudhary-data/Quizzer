export const initSentryServer = (): void => {
  if (process.env.NODE_ENV === "development") {
    console.info("Sentry server placeholder initialized");
  }
};