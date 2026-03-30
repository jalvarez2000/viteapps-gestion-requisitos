import "server-only";

// Webhooks via Svix are not active — no org-based auth in this app.
export const send = (
  _eventType: string,
  _payload: object
): Promise<void> => Promise.resolve();

export const getAppPortal = (): Promise<undefined> => Promise.resolve(undefined);
