/**
 * Authentication and Authorization Setup
 * Initializes database services for the web app
 */

import { PrismaClient } from '@workspace/database/generated/prisma';
import { PasswordAuthProvider, AuthenticationService, AuthorizationService } from '@workspace/database';

// Singleton Prisma client
const prisma = new PrismaClient();

// Initialize password auth provider
const authProvider = new PasswordAuthProvider(prisma);

// Initialize authentication service
const authService = new AuthenticationService(prisma, authProvider);

// Initialize authorization service
const authorizationService = new AuthorizationService(prisma);

export { prisma, authProvider, authService, authorizationService };

// Export prisma directly for API routes
export const db = prisma;
