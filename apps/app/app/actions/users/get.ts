"use server";

interface UserInfo {
  color: string;
  name: string;
  picture: string;
}

// Collaboration is not active — returns empty list.
export const getUsers = (
  _userIds: string[]
): Promise<{ data: UserInfo[] } | { error: unknown }> => {
  return Promise.resolve({ data: [] });
};
