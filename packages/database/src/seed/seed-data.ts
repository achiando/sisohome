/**
 * Foundation Seed Data
 * Generic, domain-agnostic seed data for the authorization foundation
 */

import { PrismaClient } from "@prisma/client/extension";


const prisma = new PrismaClient();

export async function seedFoundation() {
  console.log('🌱 Starting foundation seed...');

  try {
    // Create system permissions
    await seedPermissions();
    
    // Create system roles
    await seedSystemRoles();
    
    // Assign permissions to system roles
    await seedRolePermissions();
    
    console.log('✅ Foundation seed completed successfully');
  } catch (error) {
    console.error('❌ Foundation seed failed:', error);
    throw error;
  }
}

async function seedPermissions() {
  console.log('📋 Seeding permissions...');

  const permissions = [
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

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {},
      create: permission,
    });
  }

  console.log(`✅ Seeded ${permissions.length} permissions`);
}

async function seedSystemRoles() {
  console.log('👥 Seeding system roles...');

  const roles = [
    {
      name: 'Platform Administrator',
      slug: 'platform_admin',
      description: 'Full platform administration with all permissions',
      isSystem: true,
    },
    {
      name: 'Organization Owner',
      slug: 'organization_owner',
      description: 'Full control over organization settings and members',
      isSystem: true,
    },
    {
      name: 'Organization Administrator',
      slug: 'organization_admin',
      description: 'Administrative control within organization',
      isSystem: true,
    },
    {
      name: 'Organization Manager',
      slug: 'organization_manager',
      description: 'Management capabilities within organization',
      isSystem: true,
    },
    {
      name: 'Organization Member',
      slug: 'organization_member',
      description: 'Standard member with basic access',
      isSystem: true,
    },
    {
      name: 'Organization Viewer',
      slug: 'organization_viewer',
      description: 'Read-only access to organization data',
      isSystem: true,
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        organizationId_slug: {
          organizationId: null,
          slug: role.slug,
        },
      },
      update: {},
      create: {
        ...role,
        organizationId: null, // System roles have no organization
      },
    });
  }

  console.log(`✅ Seeded ${roles.length} system roles`);
}

async function seedRolePermissions() {
  console.log('🔐 Seeding role permissions...');

  // Get all permissions
  const allPermissions = await prisma.permission.findMany();
  const permissionMap = new Map<string, string>(allPermissions.map((p: { key: string; id: string }) => [p.key, p.id]));

  // Get system roles
  const platformAdmin = await prisma.role.findUnique({
    where: { slug: 'platform_admin' },
  });
  const orgOwner = await prisma.role.findUnique({
    where: { slug: 'organization_owner' },
  });
  const orgAdmin = await prisma.role.findUnique({
    where: { slug: 'organization_admin' },
  });
  const orgManager = await prisma.role.findUnique({
    where: { slug: 'organization_manager' },
  });
  const orgMember = await prisma.role.findUnique({
    where: { slug: 'organization_member' },
  });
  const orgViewer = await prisma.role.findUnique({
    where: { slug: 'organization_viewer' },
  });

  if (!platformAdmin || !orgOwner || !orgAdmin || !orgManager || !orgMember || !orgViewer) {
    throw new Error('System roles not found. Ensure roles are seeded first.');
  }

  // Platform Admin - ALL permissions
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: platformAdmin.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: platformAdmin.id,
        permissionId: permission.id,
      },
    });
  }

  // Organization Owner - Full organization control
  const orgOwnerPermissions = [
    'organization.read', 'organization.update', 'organization.manage',
    'user.create', 'user.read', 'user.update', 'user.delete', 'user.manage', 'user.list',
    'membership.invite', 'membership.remove', 'membership.manage', 'membership.view',
    'role.create', 'role.read', 'role.update', 'role.delete', 'role.assign', 'role.revoke', 'role.manage',
    'permission.read', 'permission.assign',
    'relationship.create', 'relationship.read', 'relationship.update', 'relationship.delete', 'relationship.manage',
    'audit.read', 'audit.export',
    'resource.create', 'resource.read', 'resource.update', 'resource.delete', 'resource.manage', 'resource.list',
  ];

  await assignPermissionsToRole(orgOwner.id, orgOwnerPermissions, permissionMap);

  // Organization Admin - Administrative control
  const orgAdminPermissions = [
    'organization.read', 'organization.update',
    'user.create', 'user.read', 'user.update', 'user.list',
    'membership.invite', 'membership.remove', 'membership.manage', 'membership.view',
    'role.create', 'role.read', 'role.update', 'role.assign', 'role.revoke',
    'permission.read',
    'relationship.create', 'relationship.read', 'relationship.update', 'relationship.delete',
    'audit.read',
    'resource.create', 'resource.read', 'resource.update', 'resource.delete', 'resource.list',
  ];

  await assignPermissionsToRole(orgAdmin.id, orgAdminPermissions, permissionMap);

  // Organization Manager - Management capabilities
  const orgManagerPermissions = [
    'organization.read',
    'user.read', 'user.update', 'user.list',
    'membership.invite', 'membership.view',
    'role.read', 'role.assign',
    'relationship.create', 'relationship.read', 'relationship.update',
    'resource.create', 'resource.read', 'resource.update', 'resource.list',
  ];

  await assignPermissionsToRole(orgManager.id, orgManagerPermissions, permissionMap);

  // Organization Member - Basic access
  const orgMemberPermissions = [
    'organization.read',
    'user.read',
    'membership.view',
    'role.read',
    'resource.read', 'resource.list',
  ];

  await assignPermissionsToRole(orgMember.id, orgMemberPermissions, permissionMap);

  // Organization Viewer - Read-only
  const orgViewerPermissions = [
    'organization.read',
    'user.read',
    'membership.view',
    'role.read',
    'resource.read', 'resource.list',
  ];

  await assignPermissionsToRole(orgViewer.id, orgViewerPermissions, permissionMap);

  console.log('✅ Seeded role permissions');
}

async function assignPermissionsToRole(
  roleId: string,
  permissionKeys: string[],
  permissionMap: Map<string, string>
) {
  for (const key of permissionKeys) {
    const permissionId = permissionMap.get(key);
    if (permissionId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
    }
  }
}

// Example usage for development/testing
export async function seedExampleOrganization() {
  console.log('🏢 Seeding example organization...');

  try {
    // Create example organization
    const organization = await prisma.organization.create({
      data: {
        name: 'Example Organization',
        slug: 'example-org',
        type: 'CORPORATION',
        status: 'ACTIVE',
        email: 'contact@example.com',
        phone: '+1234567890',
        addressLine1: '123 Business Street',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'US',
      },
    });

    // Create example location
    await prisma.organizationLocation.create({
      data: {
        organizationId: organization.id,
        name: 'Headquarters',
        type: 'HEADQUARTERS',
        addressLine1: '123 Business Street',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'US',
        isPrimary: true,
        isActive: true,
      },
    });

    console.log('✅ Example organization created:', organization.slug);
    return organization;
  } catch (error) {
    console.error('❌ Failed to create example organization:', error);
    throw error;
  }
}

export async function seedExampleUser(organizationId: string) {
  console.log('👤 Seeding example user...');

  try {
    // Create example user
    const user = await prisma.user.create({
      data: {
        authUserId: 'example-auth-user-id', // This would be replaced with actual auth user ID
        displayName: 'Example User',
        phone: '+1234567890',
        status: 'ACTIVE',
        profile: {
          create: {
            avatarUrl: null,
            bio: 'Example user for testing',
            timezone: 'UTC',
            locale: 'en',
          },
        },
      },
    });

    // Create organization membership
    const membership = await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user.id,
        status: 'ACTIVE',
      },
    });

    // Assign organization owner role
    const ownerRole = await prisma.role.findUnique({
      where: { slug: 'organization_owner' },
    });

    if (ownerRole) {
      await prisma.organizationMemberRole.create({
        data: {
          organizationMemberId: membership.id,
          roleId: ownerRole.id,
        },
      });
    }

    console.log('✅ Example user created:', user.displayName);
    return user;
  } catch (error) {
    console.error('❌ Failed to create example user:', error);
    throw error;
  }
}

// Main seed function
export async function main() {
  try {
    await seedFoundation();
    
    // Optionally seed example data for development
    if (process.env.NODE_ENV !== 'production') {
      const exampleOrg = await seedExampleOrganization();
      await seedExampleUser(exampleOrg.id);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed if executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
