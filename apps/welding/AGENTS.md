# TijwaWelders Agent Operating Contract

## 1. Mandatory Reading Order

Before modifying any TijwaWelders code, you MUST read and understand:

1. The root monorepo `AGENTS.md`.
2. The TijwaWelders `PROJECT.md`.
3. Existing technical architecture/performance documentation.
4. Existing SEO documentation.
5. Relevant existing application code and shared components.

Do not begin implementation before completing this inspection.

---

# 2. Monorepo Rule

This is an existing monorepo.

You MUST inspect before creating.

The repository already contains shared:

* UI components
* Design tokens
* Utilities
* Infrastructure
* Application patterns
* Potential integrations

**Reuse them.**

Do not create duplicate implementations.

Never create a second component when an appropriate existing component already exists.

Never replace the existing UI system with an independent TijwaWelders design system.

---

# 3. UI Components Are Mandatory

Existing UI components are not optional.

When implementing TijwaWelders:

* Search the repository for an existing component first.
* Reuse it when applicable.
* Follow its API and styling conventions.
* Extend it only when necessary.
* Do not create visually similar duplicate components.

Do not compromise this requirement for speed.

Do not say that creating a new component is easier.

The existing component architecture takes precedence.

---

# 4. Prisma / Database Rule

TijwaWelders uses **Prisma**.

It does NOT use Supabase as its database/ORM architecture.

The TijwaWelders Prisma model/database context is:

**`tijwa-db`**

`tijwa-db` is exclusively for TijwaWelders.

Do not use it in unrelated monorepo applications.

Do not introduce TijwaWelders-specific database models into other applications.

---

# 5. Database Minimalism

Do not create database tables simply because they are possible.

The intended minimal dynamic model is:

```text
Admin users/auth
Categories
Products
Projects
Project images
```

Do not add these as database entities unless the project specification is explicitly changed:

```text
Materials
Testimonials
Services
Locations
FAQs
Articles
Guides
Customers
Quotes
Orders
Payments
```

Before modifying Prisma:

1. Inspect the current schema.
2. Identify what already exists.
3. Reuse existing models where possible.
4. Determine the minimum required change.
5. Make only that change.
6. Validate the migration.

Never redesign the entire database unnecessarily.

---

# 6. No Customer Accounts

Customers do not need accounts.

Do not build:

* Customer registration
* Customer login
* Customer profiles
* Customer dashboards
* Customer roles

The site requires admin access only.

---

# 7. WhatsApp Is the Primary Conversion

Every product MUST have a quotation path.

The primary conversion channel is WhatsApp.

The secondary channel is email.

Product pages must make it easy to:

```text
View product
↓
Select quantity
↓
Add to quote
↓
Continue browsing
↓
Review quote
↓
Send to WhatsApp
```

Do not turn the website into an ecommerce checkout.

---

# 8. Quote Basket

The quote basket is lightweight.

It should support:

* Multiple products
* Quantities
* Removing products
* Updating quantities
* Reviewing selected products
* Sending the request to WhatsApp

Do not build:

* Payment
* Checkout
* Shipping
* Customer accounts
* Tax engine
* Complex pricing engine
* Order management

Client/browser state is sufficient unless the project requirements explicitly change.

---

# 9. Product Requirement

Every product page must contain:

* Product name
* Strong product imagery
* Useful description
* Relevant specifications
* Relevant options
* Appropriate pricing information if available
* Quote CTA
* Related products where useful
* Related projects where useful
* Relevant educational content where useful
* SEO metadata

The quotation CTA must be obvious.

Do not hide the quote mechanism behind unnecessary interactions.

---

# 10. SEO Is a First-Class Engineering Requirement

SEO is the highest-priority technical requirement.

SEO must influence:

* Routing
* URLs
* Rendering
* Metadata
* Headings
* Internal linking
* Images
* Structured data
* Sitemap
* Robots
* Canonicals
* Performance
* Accessibility
* Content

Do not finish the UI first and "add SEO later."

---

# 11. Google Search Guidance

For SEO implementation, use Google Search Central documentation as the primary authority.

Do not implement SEO based on:

* Keyword stuffing
* SEO myths
* Arbitrary keyword-density targets
* Mass-generated landing pages
* Fake location pages
* Manipulative internal links
* Unsupported schema claims

The objective is useful, crawlable, people-first content.

---

# 12. Product SEO

Product pages must be independently discoverable.

Use:

* Stable URLs
* Descriptive titles
* Useful meta descriptions
* Clear H1
* Logical headings
* Internal links
* Relevant structured data
* High-quality product imagery
* Appropriate alt text

Important products must be reachable through normal crawlable links.

---

# 13. Image SEO

Treat images as important search and accessibility assets.

For every meaningful image:

* Use an appropriate filename.
* Optimize file size.
* Use responsive delivery.
* Use the existing image infrastructure.
* Provide meaningful alt text.
* Avoid keyword stuffing.
* Preserve image quality.

Example:

```text
steel-sliding-gate-tijwawelders.webp
```

Good alt text:

```text
Steel sliding gate fabricated by TijwaWelders
```

Where the image shows installation:

```text
Steel sliding gate installed at a residential property
```

Never use artificial keyword-stuffed alt text.

Alt text must describe the actual image.

---

# 14. Project SEO

Projects are important landing pages.

Do not implement projects as only a JavaScript gallery.

Where appropriate, projects must have crawlable individual URLs.

A project page should contain useful contextual information and real photographs.

Only use genuine project information.

---

# 15. Location Rule

Locations are NOT database entities.

Use static content/configuration.

Do not generate large numbers of location pages.

Only create location-specific pages where there is genuine business relevance and enough useful content.

Never fabricate location-specific projects or claims.

---

# 16. Services Rule

Services are NOT database entities.

Use static content/pages.

Do not create unnecessary CRUD interfaces for services.

---

# 17. Materials Rule

Materials are NOT database entities.

Materials content exists for customer education.

Examples:

* 3/4 inch tube
* 1 inch tube
* Gauge 16
* Gauge 18
* Steel sheet
* Steel plate
* Expanded metal

Material content should link naturally to relevant products.

Do not create a database record for every steel size or gauge.

---

# 18. Testimonials Rule

Testimonials are NOT database entities.

Only publish genuine customer feedback.

Never fabricate testimonials.

---

# 19. No Fake Content

You MUST NOT invent:

* Projects
* Customers
* Testimonials
* Prices
* Locations
* Certifications
* Statistics
* Reviews
* Awards
* Technical specifications
* Business claims

Use placeholders or empty states when real content is unavailable.

---

# 20. Image Handling

Reuse the existing image/file infrastructure.

If Cloudinary already exists in the repository, use the existing integration.

Do not create a second image system.

Optimize images for:

* LCP
* Mobile
* Responsive layouts
* CDN delivery
* Browser caching
* Appropriate formats

---

# 21. Performance

Avoid unnecessary JavaScript.

Avoid unnecessary dependencies.

Avoid:

* Heavy animation libraries
* Autoplay video
* Huge images
* Unnecessary client-side rendering
* Large bundles
* Duplicate utilities

Important above-the-fold images should be handled appropriately for performance.

Do not lazy-load the primary LCP image incorrectly.

---

# 22. Accessibility

All implementations must maintain:

* Semantic HTML
* Keyboard accessibility
* Visible focus
* Correct labels
* Correct button/link semantics
* Accessible forms
* Meaningful alt text
* Adequate contrast
* Accessible navigation

Never sacrifice accessibility for visual appearance.

---

# 23. URL Discipline

URLs must be:

* Descriptive
* Stable
* Lowercase
* Human-readable
* Consistent

Do not generate unnecessary URL parameters that create indexable duplicates.

Do not casually change existing URLs.

If a URL changes, investigate redirect/canonical requirements.

---

# 24. Internal Linking

Every important page should be part of the site's internal linking structure.

Product → Category
Product → Related Project
Product → Related Product
Product → Relevant Guide
Project → Product
Project → Service
Guide → Product
Guide → Service

Use normal crawlable links.

---

# 25. Design Rule

The design must be premium through restraint.

Use the existing design system.

The interface should communicate:

* Precision
* Quality
* Trust
* Simplicity

Do not add visual decoration merely to make a section "look designed."

Every section must have a customer purpose.

---

# 26. Section Quality Rule

Before implementing a section, identify:

1. What customer question does this answer?
2. What action should the customer take?
3. What SEO purpose does the content serve?
4. Does the section need to exist?
5. Can an existing component implement it?

If the answer is unclear, stop and reassess the section.

---

# 27. Admin Simplicity

The admin experience should remain simple.

Manage:

```text
Categories
Products
Projects
Project images
```

Do not build a CMS for every piece of website text.

Static content should remain static unless there is a concrete management requirement.

---

# 28. Change Discipline

Before changing architecture:

* Inspect existing code.
* Search for existing implementations.
* Understand dependencies.
* Understand current data flow.
* Understand current UI conventions.

Do not make broad refactors without justification.

Do not remove working infrastructure without evidence that it should be removed.

Do not introduce new dependencies when existing project dependencies solve the problem.

---

# 29. SEO Quality Gate

Before declaring a page complete, verify:

### Technical

* Correct URL
* Correct rendering strategy
* Metadata
* Canonical
* Crawlable links
* Appropriate structured data
* No accidental noindex
* Correct sitemap inclusion where appropriate

### Content

* Clear H1
* Useful content
* Search intent addressed
* No keyword stuffing
* Genuine information

### Images

* Correct filename
* Optimized image
* Responsive delivery
* Meaningful alt text
* Correct dimensions

### UX

* Mobile responsive
* Clear CTA
* WhatsApp quotation path
* Accessible controls

### Performance

* No unnecessary client-side work
* Optimized assets
* No avoidable layout shift
* Good loading behavior

---

# 30. Final Agent Instruction

Build TijwaWelders as a **simple, fast, premium fabrication website with an exceptional SEO foundation and a frictionless WhatsApp quotation journey.**

Do not build a generic ecommerce system.

Do not build an over-engineered CMS.

Do not expand the database unnecessarily.

Do not duplicate existing UI.

Do not invent business information.

Do not compromise the existing monorepo architecture.

Do not compromise SEO.

Do not compromise accessibility.

Do not compromise performance.

When uncertain, prefer:

**existing infrastructure → simpler architecture → fewer database entities → better content → clearer UX → stronger SEO.**
