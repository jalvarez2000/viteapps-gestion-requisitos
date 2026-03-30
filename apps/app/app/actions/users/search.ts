"use server";

// Collaboration is not active — returns empty list.
export const searchUsers = (
  _query: string
): Promise<{ data: string[] } | { error: unknown }> => {
  return Promise.resolve({ data: [] });
};
