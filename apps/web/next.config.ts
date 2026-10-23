import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/cloudinary"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  /**
   * URL restructure — People hub (People plan Slice 2). Old canonical URLs
   * redirect to the new ones so bookmarks and in-app links keep working.
   * Rules are evaluated top-down (first match wins), so the agreements
   * subtree — which stays under /portfolio — is excluded from the owners
   * wildcard via a negative lookahead. `permanent: false` (307) on purpose:
   * these are authed pages with no SEO value, and 307 avoids browsers
   * pinning a cache entry while the IA is still settling.
   */
  async redirects() {
    return [
      // /people landing → the Employees (members) screen.
      { source: "/people", destination: "/people/employees", permanent: false },
      // Tenant directory: /leasing/tenants → /people/tenants
      { source: "/leasing/tenants", destination: "/people/tenants", permanent: false },
      { source: "/leasing/tenants/:path*", destination: "/people/tenants/:path*", permanent: false },
      // Owner parties: /portfolio/owners → /people/landlords
      // (NOT /portfolio/owners/agreements — that subtree does not move. The
      // lookahead must exclude "agreements" both at end-of-path AND as a
      // segment before any deeper path, otherwise /agreements/new would fall
      // through the rule below.)
      { source: "/portfolio/owners", destination: "/people/landlords", permanent: false },
      { source: "/portfolio/owners/new", destination: "/people/landlords/new", permanent: false },
      {
        source: "/portfolio/owners/:ownerId((?!agreements(?:/|$))[a-z0-9-]+)/:rest+",
        destination: "/people/landlords/:ownerId/:rest*",
        permanent: false,
      },
      {
        source: "/portfolio/owners/:ownerId((?!agreements(?:/|$))[a-z0-9-]+)",
        destination: "/people/landlords/:ownerId",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
