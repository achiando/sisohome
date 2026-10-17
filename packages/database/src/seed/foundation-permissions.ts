/**
 * Foundation permission catalog (Phase 1).
 * Domain keys (property.*, lease.*, work_order.*, payment.*) are layered in Phase 2.
 */

export const FOUNDATION_PERMISSIONS = [
  // Organization permissions
  { key: 'organization.create', name: 'Create Organization', description: 'Create new organizations' },
  { key: 'organization.read', name: 'View Organization', description: 'View organization details' },
  { key: 'organization.update', name: 'Update Organization', description: 'Update organization information' },
  { key: 'organization.delete', name: 'Delete Organization', description: 'Delete organizations' },
  { key: 'organization.manage', name: 'Manage Organization', description: 'Full organization management' },
  { key: 'organization.list', name: 'List Organizations', description: 'List organizations' },

  // User permissions
  { key: 'user.create', name: 'Create User', description: 'Create new users' },
  { key: 'user.read', name: 'View User', description: 'View user information' },
  { key: 'user.update', name: 'Update User', description: 'Update user information' },
  { key: 'user.delete', name: 'Delete User', description: 'Delete users' },
  { key: 'user.manage', name: 'Manage User', description: 'Full user management' },
  { key: 'user.list', name: 'List Users', description: 'List users' },

  // Membership permissions
  { key: 'membership.invite', name: 'Invite Member', description: 'Invite users to organization' },
  { key: 'membership.remove', name: 'Remove Member', description: 'Remove members from organization' },
  { key: 'membership.manage', name: 'Manage Membership', description: 'Full membership management' },
  { key: 'membership.view', name: 'View Membership', description: 'View membership information' },

  // Role permissions
  { key: 'role.create', name: 'Create Role', description: 'Create new roles' },
  { key: 'role.read', name: 'View Role', description: 'View role information' },
  { key: 'role.update', name: 'Update Role', description: 'Update role information' },
  { key: 'role.delete', name: 'Delete Role', description: 'Delete roles' },
  { key: 'role.assign', name: 'Assign Role', description: 'Assign roles to members' },
  { key: 'role.revoke', name: 'Revoke Role', description: 'Revoke roles from members' },
  { key: 'role.manage', name: 'Manage Role', description: 'Full role management' },

  // Permission permissions
  { key: 'permission.create', name: 'Create Permission', description: 'Create new permissions' },
  { key: 'permission.read', name: 'View Permission', description: 'View permission information' },
  { key: 'permission.update', name: 'Update Permission', description: 'Update permission information' },
  { key: 'permission.delete', name: 'Delete Permission', description: 'Delete permissions' },
  { key: 'permission.assign', name: 'Assign Permission', description: 'Assign permissions to roles' },
  { key: 'permission.manage', name: 'Manage Permission', description: 'Full permission management' },

  // Resource relationship permissions
  { key: 'relationship.create', name: 'Create Relationship', description: 'Create resource relationships' },
  { key: 'relationship.read', name: 'View Relationship', description: 'View resource relationships' },
  { key: 'relationship.update', name: 'Update Relationship', description: 'Update resource relationships' },
  { key: 'relationship.delete', name: 'Delete Relationship', description: 'Delete resource relationships' },
  { key: 'relationship.manage', name: 'Manage Relationship', description: 'Full relationship management' },

  // Audit permissions
  { key: 'audit.read', name: 'View Audit Logs', description: 'View audit log entries' },
  { key: 'audit.export', name: 'Export Audit Logs', description: 'Export audit log data' },

  // Platform permissions
  { key: 'platform.admin', name: 'Platform Admin', description: 'Full platform administration' },
  { key: 'platform.view', name: 'Platform View', description: 'View platform-wide information' },
  { key: 'platform.manage', name: 'Platform Manage', description: 'Platform management capabilities' },

  // Generic resource permissions (for future domains)
  { key: 'resource.create', name: 'Create Resource', description: 'Create generic resources' },
  { key: 'resource.read', name: 'View Resource', description: 'View generic resources' },
  { key: 'resource.update', name: 'Update Resource', description: 'Update generic resources' },
  { key: 'resource.delete', name: 'Delete Resource', description: 'Delete generic resources' },
  { key: 'resource.manage', name: 'Manage Resource', description: 'Full resource management' },
  { key: 'resource.list', name: 'List Resources', description: 'List generic resources' },
];
