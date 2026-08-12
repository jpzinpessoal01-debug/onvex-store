import type { Role } from "./types";

export function canAccessAdmin(role: Role, superAdminOnly = false): boolean {
  return superAdminOnly ? role === "SUPER_ADMIN" : role === "ADMIN" || role === "SUPER_ADMIN";
}

