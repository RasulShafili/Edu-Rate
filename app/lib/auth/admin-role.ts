export type AdminAccessRole = "owner_admin" | "admin" | "assistant_admin";
export type AssignableUserRole = "student" | "mentor" | "teacher";

export type AdminCapabilities = {
  role: AdminAccessRole;
  canAccessPanel: true;
  canManageContent: true;
  canManageUsers: boolean;
  canCreateUsers: boolean;
  canEditPrivilegedUsers: boolean;
  canDeleteUsers: boolean;
  canAssignElevatedRoles: boolean;
};

export function isAdminAccessRole(value: unknown): value is AdminAccessRole {
  return value === "owner_admin" || value === "admin" || value === "assistant_admin";
}

export function getAdminCapabilities(role: AdminAccessRole): AdminCapabilities {
  const isOwner = role === "owner_admin";
  return {
    role,
    canAccessPanel: true,
    canManageContent: true,
    canManageUsers: true,
    canCreateUsers: isOwner,
    canEditPrivilegedUsers: isOwner,
    canDeleteUsers: isOwner,
    canAssignElevatedRoles: isOwner,
  };
}

export function isAssignableUserRole(value: unknown): value is AssignableUserRole {
  return value === "student" || value === "mentor" || value === "teacher";
}

/**
 * Administrator hesablarını yalnız platforma sahibi dəyişir — `canEditPrivilegedUsers`
 * ilə eyni qayda. Əvvəl adi admin digər adminləri redaktə edə bilirdi (D4) və backend
 * də buna icazə verirdi (D3).
 */
export function canEditUserRole(
  actorRole: AdminAccessRole,
  targetRole: string,
): boolean {
  if (actorRole === "owner_admin") return true;
  return isAssignableUserRole(targetRole);
}
