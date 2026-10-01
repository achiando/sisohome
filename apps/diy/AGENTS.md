# AGENTS.md — DIY

## 1. PURPOSE

This file is the mandatory operating contract for any coding agent working on the DIY application.

DIY is a product discovery, technical education, projects, and quotation platform.

It is **not an ecommerce checkout application**.

The primary customer journey is:

```text
Discover
→ Understand
→ Select Products
→ Add to Quote
→ Review
→ WhatsApp
→ Human Quotation
```

The three major content pillars are:

```text
Products
Projects
Guides
```

They must operate as one connected system.

---

# 2. MANDATORY READING BEFORE CODING

Before modifying any DIY code, the agent MUST read and understand:

1. The monorepo root `AGENTS.md`.
2. The DIY `PROJECT.md`.
3. The technical architecture/performance document.
4. The SEO document.
5. Relevant existing application documentation.
6. The existing Prisma schema.
7. Relevant Prisma migrations.
8. Existing shared UI components.
9. Existing design tokens.
10. Existing image/media infrastructure.
11. Existing SEO utilities.
12. Existing authentication/admin infrastructure.
13. Existing quote/contact/WhatsApp infrastructure if present.

Do not begin implementation before understanding these systems.

If one of the required documents is missing, locate it using the repository's existing structure before making assumptions.

---

# 3. ROOT AGENTS.MD ALWAYS WINS

This application exists inside a larger monorepo.

The root `AGENTS.md` is authoritative for repository-wide rules.

This file adds DIY-specific rules.

When there is a conflict:

```text
Root AGENTS.md
        ↓
DIY AGENTS.md
        ↓
DIY PROJECT.md
        ↓
Task-specific instructions
```

The agent must respect all higher-level repository rules.

---

# 4. PROJECT.MD IS THE PRODUCT SOURCE OF TRUTH

`PROJECT.md` defines:

* product requirements
* information architecture
* data requirements
* page structures
* SEO requirements
* quotation behavior
* project behavior
* product behavior
* guide behavior
* design principles
* performance expectations
* accessibility requirements
* definition of done

Do not silently redefine requirements in code.

If implementation details conflict with the intended product behavior, stop and inspect the architecture before proceeding.

---

# 5. INSPECT BEFORE MODIFYING

Never begin by immediately creating files or models.

First inspect:

* repository structure
* DIY application structure
* package configuration
* existing routes
* shared components
* design system
* Prisma schema
* migrations
* database client
* authentication
* admin
* image system
* SEO utilities
* existing content models
* existing search
* existing forms
* existing quote/contact mechanisms

The objective is to reuse what already exists.

---

# 6. DO NOT REBUILD EXISTING INFRASTRUCTURE

If the monorepo already provides:

* Button
* Input
* Select
* Dialog
* Drawer
* Modal
* Card
* Breadcrumb
* Header
* Footer
* Navigation
* Form components
* Image components
* SEO utilities
* database utilities
* authentication
* admin components
* upload components
* search utilities
* analytics
* WhatsApp helpers

reuse them.

Do not create DIY-specific copies without a documented architectural reason.

---

# 7. SHARED UI IS SACRED

DIY must use the existing shared UI/design system.

Do not:

* fork the design system
* create duplicate tokens
* create duplicate button systems
* create duplicate typography systems
* introduce arbitrary spacing systems
* create one-off components that duplicate shared functionality

If a new component is genuinely reusable across applications, place it in the appropriate shared location according to repository architecture.

---

# 8. DO NOT MAKE ASSUMPTIONS ABOUT THE STACK

Before implementing:

* routing
* server rendering
* client state
* database access
* image handling
* authentication
* admin
* SEO
* forms

inspect how the monorepo already solves these problems.

Do not introduce a new framework or library simply because it is familiar.

Use the existing stack.

---

# 9. PRISMA RULES

DIY uses the existing Prisma/database infrastructure.

Before modifying Prisma:

1. Read the existing schema.
2. Identify existing reusable models.
3. Inspect related migrations.
4. Understand relationships.
5. Understand the project's migration workflow.
6. Determine whether the required DIY entity already exists.
7. Make the smallest safe change.

Never redesign the entire database to accommodate one feature.

---

# 10. DIY DATABASE BOUNDARY

The initial DIY domain should remain minimal.

Expected concepts include:

```text
DiyCategory
DiyProduct
DiyProductImage
DiyProject
DiyProjectImage
```

Potentially:

```text
DiyProductVariant
DiyProjectProduct
```

only when actual requirements justify them.

Do not create unnecessary models for:

* customers
* quotes
* orders
* payments
* checkout
* reviews
* testimonials
* CRM
* shipping
* suppliers
* warehouses
* inventory

The quote is initially client-side and sent to WhatsApp.

---

# 11. DO NOT CONTAMINATE OTHER APPLICATIONS

DIY-specific:

* models
* fields
* naming
* queries
* database logic
* business rules

must not be spread into unrelated applications.

Do not modify another application's data model simply because DIY needs a similar concept.

First inspect whether an existing shared abstraction is appropriate.

If not, create a properly scoped DIY implementation.

---

# 12. PRODUCT ARCHITECTURE

DIY products must use a unified product model.

Do not create separate models for:

* resistors
* capacitors
* sensors
* motors
* ICs
* tools
* power supplies
* connectors
* modules

A single product architecture must support all of them.

Use structured/flexible specifications where supported by the existing architecture.

Do not create hundreds of nullable technical columns.

---

# 13. TECHNICAL DATA MUST BE TRUTHFUL

Never invent:

* voltage
* current
* resistance
* capacitance
* tolerance
* power
* speed
* torque
* dimensions
* accuracy
* operating range
* compatibility
* manufacturer
* model number
* specifications

If the source data is missing, leave it unavailable or clearly indicate that the information needs confirmation.

Do not make technical assumptions just to complete a UI.

---

# 14. PRODUCT VARIANTS

Do not implement a complex variant engine unless the actual product requirements require it.

Variants may be required when products genuinely differ in:

* SKU
* price
* specifications
* availability
* images
* package
* voltage
* size
* capacity

If variants are required, inspect existing patterns first.

Do not create unnecessary abstractions.

---

# 15. PRODUCT QUANTITIES

The quote system must support quantities.

Examples:

```text
10kΩ Resistor — Qty 20
HC-SR04 Sensor — Qty 3
Breadboard — Qty 1
5m Hook-up Wire — Qty 2
```

The implementation must correctly distinguish:

* quantity
* pack size
* unit

For example:

> Pack of 10 × quantity 3

means:

> 3 packs / 30 individual pieces

Do not silently reinterpret quantities.

---

# 16. PRODUCTS ARE NOT ORDERS

A product selection does not create an order.

The application does not currently perform:

* checkout
* payment
* shipping
* order confirmation
* online purchasing

The user is requesting a quotation.

Use appropriate language:

* Add to Quote
* Request a Quote
* Quote
* Quotation
* Request Quote on WhatsApp

Avoid:

* Add to Cart
* Checkout
* Buy Now
* Place Order
* Pay Now

unless a future requirement explicitly changes the business model.

---

# 17. QUOTE STATE

The quote basket is temporary client-side state.

It should:

* survive normal navigation
* support quantities
* support multiple different products
* support removal
* support quantity changes
* support project-generated selections
* support continued browsing
* generate a WhatsApp message

Use existing state/persistence patterns where available.

Do not create a server-side quote database.

---

# 18. WHATSAPP IS THE PRIMARY CONVERSION

Every major commercial journey should have a clear WhatsApp path.

Primary actions include:

* Add to Quote
* Request Quote
* Request Quote on WhatsApp
* Add Project to Quote

The WhatsApp number must come from the application's authoritative configuration.

Do not hardcode it in multiple components.

---

# 19. WHATSAPP MESSAGE

Generated WhatsApp messages should be:

* readable
* concise
* human-friendly
* complete enough for quotation

They may include:

* greeting
* product name
* quantity
* pack/unit
* project name
* displayed price/range where appropriate
* product URLs where useful
* request for quotation

Never include:

* database IDs
* internal identifiers
* implementation details
* private admin information

---

# 20. EMAIL IS SECONDARY

Email may be offered as a secondary quotation/contact option.

It must never obscure the primary WhatsApp journey.

Reuse existing email/contact infrastructure.

Do not build a new email system if one already exists.

---

# 21. PROJECTS ARE FIRST-CLASS

Projects are not blog posts.

They are a core part of the DIY product experience.

Projects should connect:

```text
Project
↓
Products
↓
Quote
```

and:

```text
Project
↓
Guides
↓
Products
```

---

# 22. PROJECT QUALITY

Do not create project pages simply for SEO.

A project should contain genuine value.

Where appropriate, include:

* objective
* overview
* required products
* quantities
* explanation
* build steps
* technical considerations
* images
* applications
* related guides
* related products

Do not publish thin or fabricated projects.

---

# 23. PROJECT PRODUCT RELATIONSHIPS

Before creating a project/product join table:

1. Inspect existing Prisma patterns.
2. Check whether a reusable relationship already exists.
3. Confirm that project-level product selection is actually required.

If implemented, the relationship may support:

* product
* quantity
* required/recommended
* notes
* display order

Do not add unnecessary fields.

---

# 24. ADD PROJECT TO QUOTE

Where a project has valid associated products:

**Add Project to Quote**

should:

1. Load associated products.
2. Add them to the existing quote.
3. Use defined quantities.
4. Preserve existing quote items.
5. Allow editing.
6. Allow removal.
7. Allow additional products.
8. Allow WhatsApp quotation.

If a project has no valid products, do not show a broken action.

---

# 25. GUIDES

Guides are educational content.

They should:

* answer real questions
* explain technical concepts
* help customers choose products
* link naturally to products
* link naturally to projects
* remain technically accurate

Do not use guides as keyword-stuffed advertising pages.

---

# 26. INTERNAL LINKING

Build an intentional content graph.

Examples:

```text
Product
→ Category
→ Related Products
→ Projects
→ Guides
```

```text
Project
→ Products
→ Guides
→ Related Projects
```

```text
Guide
→ Products
→ Projects
→ Categories
```

Important pages must be reachable through normal crawlable links.

---

# 27. SEO IS A FIRST-CLASS REQUIREMENT

SEO is not a final polish step.

SEO must influence the architecture from the beginning.

Consider:

* crawlability
* URLs
* rendering
* metadata
* headings
* canonical URLs
* sitemap
* robots
* structured data
* internal linking
* image SEO
* performance
* accessibility

Google Search Central is the SEO authority.

Do not implement SEO based solely on outdated tutorials or assumptions.

---

# 28. SEO URL RULES

Use:

* lowercase
* descriptive
* stable
* readable
* hierarchical where useful

Example:

```text
/products/electronics/resistors/10k-ohm-resistor
/projects/electronics/automatic-plant-watering-system
/guides/how-to-choose-a-power-supply
```

Avoid:

```text
/product?id=123
/p/92837
/item?sku=123
```

Do not expose database IDs in canonical URLs.

---

# 29. INDEXING RULES

Important pages should be indexable.

Do not allow uncontrolled indexing of:

* search result pages
* arbitrary filters
* sorting parameters
* duplicate URLs
* temporary query combinations

Filtering is primarily a UX feature.

Only create indexable filtered landing pages when there is a deliberate SEO/content reason.

---

# 30. METADATA

Every important page must have:

* unique title
* unique meta description
* canonical URL
* appropriate social metadata
* correct indexing directives

Metadata must describe the actual page.

Do not keyword stuff.

---

# 31. STRUCTURED DATA

Use structured data only when supported by visible, truthful page content.

Potential types include:

* Product
* BreadcrumbList
* Organization
* LocalBusiness where appropriate
* Article for genuine guides

Do not fabricate:

* ratings
* reviews
* prices
* stock
* brands
* business information

Never create fake review schema.

---

# 32. IMAGE REQUIREMENTS

Use the existing image infrastructure.

Every important image should have:

* optimized file format
* correct dimensions
* responsive delivery
* CDN delivery where available
* meaningful filename
* meaningful alt text
* appropriate loading behavior

Example:

```text
hc-sr04-ultrasonic-distance-sensor.jpg
```

Alt:

> HC-SR04 ultrasonic distance sensor module

Do not use keyword-stuffed alt text.

---

# 33. PERFORMANCE

Performance is a product requirement.

Prioritize:

* LCP
* INP
* CLS
* image optimization
* responsive images
* caching
* CDN
* minimal JavaScript
* efficient fonts
* server/static rendering where appropriate

Avoid:

* unnecessary client components
* unnecessary dependencies
* huge JavaScript bundles
* oversized images
* autoplay video
* heavy animation
* unnecessary sliders

Do not sacrifice performance for decorative UI.

---

# 34. ACCESSIBILITY

Every feature must be accessible.

Use:

* semantic HTML
* proper headings
* correct buttons
* correct links
* keyboard navigation
* visible focus
* accessible labels
* sufficient contrast
* accessible dialogs
* accessible quantity controls
* meaningful alt text

Never use a clickable `<div>` where a button or link is appropriate.

---

# 35. MOBILE-FIRST

Build mobile-first.

Pay special attention to:

* product grids
* product specifications
* search
* filters
* quote controls
* WhatsApp CTA
* project galleries
* project steps
* guide content
* navigation

Do not allow sticky controls to hide important content.

---

# 36. DESIGN PRINCIPLE

The visual experience should be:

* clean
* technical
* modern
* practical
* trustworthy
* product-focused
* premium through restraint

Use the existing design system.

Avoid:

* excessive gradients
* excessive shadows
* excessive cards
* oversized typography everywhere
* decorative animation
* fake urgency
* popups
* visual clutter

The products and project imagery should provide much of the visual interest.

---

# 37. HOMEPAGE PRINCIPLE

The homepage should tell a clear story.

Recommended structure:

```text
Hero
↓
Shop by Category
↓
Featured Products
↓
Projects
↓
Why DIY
↓
Guides
↓
Final Quote CTA
```

Do not create a homepage containing dozens of unrelated sections.

One dominant message should lead each section.

---

# 38. PRODUCT PAGE PRINCIPLE

A product page should answer:

> What is this, is it suitable for my needs, and how do I request it?

Recommended structure:

```text
Breadcrumb
Product
Image
Price/range if available
Pack/unit
Quantity
Add to Quote
Overview
Specifications
Applications
Compatibility
Related Products
Related Projects
Related Guides
WhatsApp CTA
```

The quotation CTA must be easy to find.

---

# 39. PROJECT PAGE PRINCIPLE

A project page should answer:

> What can I build, what do I need, and how do I get the required products?

Recommended structure:

```text
Breadcrumb
Project Hero
Overview
What You Need
How It Works
Build Steps
Products Used
Images
Related Guides
Related Projects
Add Project to Quote
WhatsApp CTA
```

---

# 40. GUIDE PAGE PRINCIPLE

A guide should answer:

> What do I need to understand to make a good decision?

It should naturally connect to:

* products
* projects
* categories

without becoming a sales page.

---

# 41. SEARCH PRINCIPLE

Search must help users find more than products.

Results may include:

```text
Products
Projects
Guides
Categories
```

The result type must be obvious.

Reuse existing search infrastructure where available.

Do not introduce a second search engine without a strong architectural reason.

---

# 42. ADMIN PRINCIPLE

Reuse the existing admin architecture.

Admin users should be able to manage:

### Categories

* create
* edit
* reorder
* publish/unpublish

### Products

* create
* edit
* specifications
* images
* pricing
* pack/unit
* publishing
* featured status

### Projects

* create
* edit
* images
* content
* steps
* associated products
* quantities
* required/recommended state
* publishing
* featured status

Do not build a separate admin application.

---

# 43. ADMIN SECURITY

All admin operations must be authenticated and authorized server-side.

Never trust client-side authorization.

Never:

* hardcode credentials
* expose secrets
* expose database credentials
* bypass authentication
* expose private fields

Reuse the existing authentication system.

---

# 44. NO FABRICATED CONTENT

This rule is absolute.

Never invent:

* products
* product specifications
* prices
* stock
* brands
* projects
* customer information
* project results
* testimonials
* reviews
* certifications
* business history
* locations
* technical claims

If placeholder content is required during development, make it unmistakably development-only.

Before production, remove it.

---

# 45. NO FAKE SEO

Do not create:

* keyword-stuffed pages
* doorway pages
* hundreds of location pages
* thin project pages
* duplicate product pages
* fake review schema
* fake product information
* autogenerated nonsense content

SEO should come from useful content, good architecture, strong internal linking, crawlability, performance, and accurate metadata.

---

# 46. CONTENT MUST BE REAL

If a required product attribute is unknown:

Do not guess.

If a project does not have enough useful information:

Do not publish it.

If a guide requires technical verification:

Verify it before publishing.

Accuracy is more important than filling every field.

---

# 47. CODE QUALITY

Write code that is:

* readable
* typed where the project uses typing
* modular
* testable
* consistent with existing conventions
* minimally complex

Avoid premature abstraction.

Avoid giant components.

Avoid duplicated logic.

Avoid unnecessary hooks.

Avoid unnecessary client-side state.

Avoid unnecessary dependencies.

---

# 48. COMPONENT DESIGN

Prefer composable components.

Examples:

* ProductCard
* ProductGrid
* ProductGallery
* ProductSpecifications
* AddToQuoteButton
* QuantityControl
* QuoteSummary
* ProjectCard
* ProjectProductList
* GuideCard
* Breadcrumbs
* Search
* CategoryNavigation

Before creating any component, check whether an equivalent shared component already exists.

---

# 49. SERVER VS CLIENT

Use server rendering/server components where the existing framework supports them and where appropriate.

Use client-side code only where interaction requires it.

Examples that may require client behavior:

* quote basket
* quantity controls
* filters
* interactive search
* mobile navigation
* dialogs

Do not turn entire pages into client applications unnecessarily.

---

# 50. ERROR HANDLING

Handle:

* missing product
* missing project
* missing guide
* invalid slug
* missing image
* empty search
* empty quote
* invalid quantity
* unavailable project product
* WhatsApp generation failure
* network failure
* database errors

Errors should be understandable to users.

Do not expose internal stack traces.

---

# 51. EMPTY STATES

Empty quote:

> Your quote is empty.

> Add products to request a quotation.

CTA:

**Browse Products**

No search results:

> No products, projects, or guides matched your search.

Offer useful next actions.

---

# 52. ANALYTICS

If the monorepo already has analytics, reuse it.

Useful events may include:

```text
product_view
project_view
guide_view
category_view
search
add_to_quote
remove_from_quote
quote_view
whatsapp_quote_click
email_quote_click
add_project_to_quote
```

Do not install another analytics platform unnecessarily.

---

# 53. TESTING

Test all major journeys.

### Product

```text
Search
→ Product
→ Add to Quote
→ Quantity
→ Quote
→ WhatsApp
```

### Project

```text
Search
→ Project
→ Products
→ Add Project to Quote
→ Modify
→ WhatsApp
```

### Guide

```text
Search
→ Guide
→ Product
→ Add to Quote
→ WhatsApp
```

### Mobile

Test all flows on mobile.

### Admin

Test:

* product creation
* editing
* image upload
* project creation
* product/project association
* publishing
* unpublishing

---

# 54. DATABASE TESTING

After Prisma changes:

* validate schema
* run appropriate migration checks
* verify generated client
* verify affected queries
* verify existing applications
* verify no unrelated models were modified
* verify migration safety

Never assume a successful migration means the application is correct.

---

# 55. SEO TESTING

Before considering the application complete, verify:

* titles
* descriptions
* canonicals
* robots
* sitemap
* breadcrumbs
* structured data
* headings
* URLs
* internal links
* image alt text
* crawlability
* duplicate content
* indexability

Important public pages must be reachable without client-side-only navigation.

---

# 56. PERFORMANCE TESTING

Verify:

* LCP
* INP
* CLS
* image sizes
* image loading
* font loading
* JavaScript bundle size
* unnecessary client rendering
* layout stability

Do not declare performance complete merely because the page "feels fast."

---

# 57. ACCESSIBILITY TESTING

Verify:

* keyboard navigation
* focus states
* form labels
* buttons
* links
* dialogs
* mobile navigation
* contrast
* screen-reader semantics
* quantity controls
* quote controls

---

# 58. DEVELOPMENT ORDER

Use this implementation order unless repository architecture requires another sequence.

### Phase 1

Repository and architecture inspection.

### Phase 2

Data architecture and Prisma.

### Phase 3

Shared layout and navigation.

### Phase 4

Product catalog.

### Phase 5

Product detail pages.

### Phase 6

Projects.

### Phase 7

Project/product relationships.

### Phase 8

Guides.

### Phase 9

Quote system.

### Phase 10

WhatsApp/email quotation.

### Phase 11

Admin.

### Phase 12

SEO.

### Phase 13

Performance/accessibility.

### Phase 14

Testing and QA.

---

# 59. BEFORE EVERY SIGNIFICANT CHANGE

Ask:

1. Does this requirement already exist?
2. Is there already a component for this?
3. Is there already a utility for this?
4. Is there already a database model for this?
5. Is there already an image system for this?
6. Is there already a search implementation?
7. Is there already an authentication system?
8. Does this change affect SEO?
9. Does this change affect performance?
10. Does this change affect another application?

Prefer reuse over recreation.

---

# 60. BEFORE DATABASE CHANGES

Always answer:

```text
What existing model can be reused?

Why is a new model necessary?

What applications are affected?

What migration will be generated?

Can this be implemented more simply?
```

If the answer is unclear, inspect more before modifying the schema.

---

# 61. BEFORE CREATING A NEW DEPENDENCY

Ask:

```text
Does the repository already solve this?

Can an existing package solve this?

Is the dependency necessary?

What performance cost does it introduce?

Does it duplicate existing functionality?
```

Avoid dependency sprawl.

---

# 62. BEFORE CREATING A NEW PAGE

Ask:

```text
What user problem does this page solve?

Is it useful independently?

Does it have unique content?

Should it be indexable?

Where will users reach it from?

What pages should it link to?

Will it create duplicate/thin content?
```

Do not create pages only because they are easy to generate.

---

# 63. BEFORE CREATING A NEW MODEL

Ask:

```text
Is this a real domain entity?

Can an existing model represent it?

Does the feature genuinely require persistence?

Can it remain configuration/static content?

Is the model necessary for the current business requirement?
```

Default to the smallest valid data model.

---

# 64. DEFINITION OF DONE

A feature is not complete simply because it works visually.

It must also satisfy:

* architecture
* data integrity
* security
* SEO
* accessibility
* performance
* responsive behavior
* error handling
* empty states
* shared component reuse
* testing

---

# 65. FINAL QUALITY GATE

Before marking a feature complete, verify:

### Architecture

* Existing architecture respected.
* Shared components reused.
* No duplicate systems.
* No unnecessary dependencies.

### Database

* Prisma changes are minimal.
* No unnecessary models.
* No unrelated application impact.

### Products

* Product pages work.
* Technical specifications work.
* Images work.
* Quantity works.
* Add to Quote works.

### Projects

* Project pages work.
* Project images work.
* Product relationships work.
* Add Project to Quote works where applicable.

### Guides

* Guides work.
* Product links work.
* Project links work.

### Quote

* Add/remove works.
* Quantities work.
* Persistence works.
* WhatsApp generation works.
* Email fallback works.

### SEO

* Metadata works.
* Canonicals work.
* Sitemap works.
* Robots works.
* Structured data is truthful.
* Internal linking works.

### Performance

* Images optimized.
* LCP protected.
* INP protected.
* CLS protected.
* No unnecessary JavaScript.

### Accessibility

* Keyboard accessible.
* Focus visible.
* Semantic markup.
* Forms labelled.
* Controls accessible.

### Content

* No fabricated claims.
* No fake data.
* No fake reviews.
* No fake prices.
* No fake projects.

---

# 66. FINAL AGENT RULE

When in doubt:

**Inspect first. Reuse second. Simplify third. Implement fourth.**

Never:

* guess the architecture
* guess technical specifications
* invent content
* duplicate infrastructure
* over-engineer the database
* turn the quote system into ecommerce
* compromise SEO for UI
* compromise performance for decoration
* compromise accessibility for visual design

The goal is not to build the largest system.

The goal is to build the **simplest robust system that delivers the complete DIY product + project + guide + quotation experience**.

The final experience should feel coherent:

```text
              DIY
               │
     ┌─────────┼─────────┐
     ↓         ↓         ↓
  Products  Projects   Guides
     │         │         │
     └────┬────┴────┬────┘
          ↓         ↓
       Discover → Understand
              ↓
         Add to Quote
              ↓
           WhatsApp
              ↓
      Human Quotation
```

Build the system around this model.
