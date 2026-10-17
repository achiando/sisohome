/**
 * Foundation Seed Data
 * Generic, domain-agnostic seed data for the authorization foundation
 */

import { prisma } from "../prisma";
import { ensureGlobalRoleSlugIndex, seedOrgKindRoles } from "./org-kind-templates";
import { FOUNDATION_PERMISSIONS } from "./foundation-permissions";

export async function seedFoundation() {
  console.log('🌱 Starting foundation seed...');

  try {
    // DB-level uniqueness for global (system) role slugs — Prisma cannot
    // express a partial unique index in the schema.
    await ensureGlobalRoleSlugIndex(prisma as never);

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

  const permissions = FOUNDATION_PERMISSIONS;

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
    // Compound unique lookups reject null in Prisma, so global roles are
    // matched with findFirst (the partial unique index guarantees safety).
    const existing = await prisma.role.findFirst({
      where: { organizationId: null, slug: role.slug },
    });
    if (!existing) {
      await prisma.role.create({
        data: {
          ...role,
          organizationId: null, // System roles have no organization
        },
      });
    }
  }

  console.log(`✅ Seeded ${roles.length} system roles`);
}

async function seedRolePermissions() {
  console.log('🔐 Seeding role permissions...');

  // Get all permissions
  const allPermissions = await prisma.permission.findMany();
  const permissionMap = new Map<string, string>(allPermissions.map((p: { key: string; id: string }) => [p.key, p.id]));

  // Get system roles
  const platformAdmin = await prisma.role.findFirst({ where: { organizationId: null, slug: 'platform_admin' } });
  const orgOwner = await prisma.role.findFirst({ where: { organizationId: null, slug: 'organization_owner' } });
  const orgAdmin = await prisma.role.findFirst({ where: { organizationId: null, slug: 'organization_admin' } });
  const orgManager = await prisma.role.findFirst({ where: { organizationId: null, slug: 'organization_manager' } });
  const orgMember = await prisma.role.findFirst({ where: { organizationId: null, slug: 'organization_member' } });
  const orgViewer = await prisma.role.findFirst({ where: { organizationId: null, slug: 'organization_viewer' } });

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
    // Idempotent: reuse the example org on re-runs
    const existing = await prisma.organization.findUnique({ where: { slug: 'example-org' } });
    if (existing) {
      // Heal runs that created the org before templates existed
      if (existing.kind !== 'LANDLORD') {
        await prisma.organization.update({ where: { id: existing.id }, data: { kind: 'LANDLORD' } });
      }
      await seedOrgKindRoles(prisma as never, existing.id, 'LANDLORD');
      console.log('✅ Example organization already exists:', existing.slug);
      return existing;
    }

    const organization = await prisma.organization.create({
      data: {
        name: 'Example Organization',
        slug: 'example-org',
        type: 'CORPORATION',
        kind: 'LANDLORD',
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

    // Seed the LANDLORD role templates for this org
    await seedOrgKindRoles(prisma as never, organization.id, 'LANDLORD');

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
    // Idempotent: reuse the example user on re-runs
    const existing = await prisma.user.findUnique({ where: { email: 'example@example.com' } });
    if (existing) {
      // Heal runs that created the user but died before membership/roles
      const existingMembership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: existing.id } },
      });
      if (!existingMembership) {
        const healedMembership = await prisma.organizationMember.create({
          data: { organizationId, userId: existing.id, status: 'ACTIVE' },
        });
        const ownerRole =
          (await prisma.role.findFirst({ where: { organizationId, slug: 'owner' } })) ??
          (await prisma.role.findFirst({ where: { organizationId: null, slug: 'organization_owner' } }));
        if (ownerRole) {
          await prisma.organizationMemberRole.create({
            data: { organizationMemberId: healedMembership.id, roleId: ownerRole.id },
          });
        }
      }
      console.log('✅ Example user already exists:', existing.email);
      return existing;
    }

    const user = await prisma.user.create({
      data: {
        email: 'example@example.com',
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

    // Prefer the org's LANDLORD `owner` template role; fall back to the system role
    const ownerRole =
      (await prisma.role.findFirst({ where: { organizationId, slug: 'owner' } })) ??
      (await prisma.role.findFirst({ where: { organizationId: null, slug: 'organization_owner' } }));

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
