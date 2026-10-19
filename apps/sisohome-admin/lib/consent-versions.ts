/**
 * Published consent document versions — dependency-free so public legal
 * pages (/terms, /privacy) can display them without importing the DB stack.
 * Bump a version when the document text changes; see lib/consent.ts for
 * how acceptance is recorded against these.
 */

import type { ConsentType } from '@workspace/database';

export const CONSENT_VERSIONS: Record<ConsentType, string> = {
  TERMS_OF_SERVICE: 'v1-2026-10-19',
  PRIVACY_POLICY: 'v1-2026-10-19',
};
