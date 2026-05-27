import { permissionsRepository, buildPermissionGroups } from "./permissions.repository.js";
import type {
  PermissionCatalogEntry,
  PermissionGroupKey,
} from "./permissions.types.js";

export type PermissionCatalogResponse = {
  permissions: PermissionCatalogEntry[];
  permissionGroups: {
    key: PermissionGroupKey;
    label: string;
    description: string;
    permissionCount: number;
    permissions: PermissionCatalogEntry[];
  }[];
};

export const permissionsService = {
  async getCatalog(): Promise<PermissionCatalogResponse> {
    const permissions = await permissionsRepository.listPermissions();

    return {
      permissions,
      permissionGroups: buildPermissionGroups(permissions),
    };
  },

  async listPermissions() {
    return permissionsRepository.listPermissions();
  },
};
