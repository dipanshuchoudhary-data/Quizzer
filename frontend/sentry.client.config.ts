export const initSentryClient = (): void => {
  if (process.env.NODE_ENV === "development") {
    console.info("Sentry client placeholder initialized");
  }
};