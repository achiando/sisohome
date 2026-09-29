TijwaWelders — Project Specification
1. Project Identity

Project: TijwaWelders Website

Primary purpose:
Build a fast, premium, SEO-first website for TijwaWelders, a welding and metal fabrication business serving customers in Kenya.

The website is primarily a:

Product catalogue
Fabrication services presentation
Real-project/work showcase
Customer education resource
Quote-request system
WhatsApp conversion platform

It is not a traditional ecommerce store.

There is:

No online checkout
No online payment
No customer account system
No automated fabrication quotation engine
No complex measurement/configuration engine
No unnecessary CRM
No unnecessary backend persistence for quote requests

The primary conversion is:

Search → Product/Project/Service → Understand the work → Add product to quotation → Send quotation request via WhatsApp → Human follow-up

Email is the secondary contact channel.

2. Non-Negotiable Priorities

The implementation must follow this priority order:

SEO and discoverability
Clarity and usability
Conversion to WhatsApp quotation/contact
Performance
Accessibility
Real project/product credibility
Maintainability
Visual polish

Do not sacrifice SEO, accessibility, performance, or usability for visual effects.

Do not add features merely because they are technically possible.

3. Required Existing Project Documents

Before changing anything, the coding agent MUST read:

The existing root-level AGENTS.md for the entire monorepo.
This PROJECT.md.
Any existing technical architecture/performance documentation.
Any existing SEO documentation.
Existing project/package documentation relevant to the application.

The root AGENTS.md remains authoritative for monorepo-wide development rules.

This project specification defines the TijwaWelders-specific requirements.

The agent must understand and follow both.

4. Existing Monorepo Must Be Respected

The monorepo already contains:

Shared UI components
Design tokens
Layout components
Utilities
Infrastructure
Existing application patterns
Potentially existing authentication, database, image, SEO, and API utilities

Before creating anything, inspect the repository.

Never create duplicate infrastructure.

Do not create another:

Button component
Card component
Modal
Dialog
Form system
Input component
Navigation system
Header
Footer
Toast system
Image component
SEO utility
API client
Database client
Authentication system
Design system
Utility library
Cloudinary integration
Loading system
Error system

if an existing implementation already serves the purpose.

Existing shared UI components MUST be reused.

Do not replace existing components with custom versions simply because another implementation looks easier.

Do not compromise the existing component architecture.

If an existing component needs a small extension, extend it carefully instead of duplicating it.

5. Database Architecture

The project uses Prisma, not Supabase.

Prisma is the ORM/database layer for TijwaWelders.

The TijwaWelders database/model context is:

tijwa-db

The tijwa-db model must be used only for TijwaWelders.

Do not introduce tijwa-db models, tables, naming, or business-specific database logic into unrelated applications in the monorepo.

Minimal database principle

Only information that genuinely requires database persistence should be stored in the database.

The initial dynamic model should contain only:

Admin users/auth
Categories
Products
Projects
Project images

Potential relationships:

Category
   └── Products

Project
   └── Project Images

A product/project relationship may be added only if it is genuinely required by the existing architecture.

Do not invent additional relationships.

6. Explicitly DO NOT Add These to the Database

The following are intentionally outside the initial database model:

Materials
Testimonials
Services
Locations
FAQs
Articles
Guides
Customers
Customer accounts
Quote records
Orders
Payments
Shopping carts
CRM records

These may exist as static content, configuration, or application state where appropriate.

The absence of a database table does not prevent content from having an SEO-friendly page.

7. Admin Model

The website requires administration, but administration must remain simple.

There should be an admin authentication system.

There are no customer accounts.

There is no need for:

Customer roles
Staff roles
Complex permissions
Multi-level RBAC
Customer dashboards

The initial role concept is simply:

ADMIN

Use the existing authentication architecture where available.

Never hardcode credentials into frontend code.

Never expose administrative secrets to the client.

8. Website Communication Strategy
Primary channel: WhatsApp

WhatsApp is the primary conversion channel throughout the website.

Customers should be able to:

Ask questions
Request quotations
Send multiple products in one quotation request
Contact TijwaWelders directly
Secondary channel: Email

Email is the secondary communication channel.

Phone contact may also be displayed where appropriate, but WhatsApp remains the primary digital conversion mechanism.

9. Quote System

This is NOT ecommerce.

Every product MUST have a clear quotation path.

The customer should be able to:

Open a product.
Understand the product.
Select a quantity.
Add it to a quotation.
Continue browsing.
Add other products.
Open the quotation basket.
Review selected products and quantities.
Send the request to TijwaWelders through WhatsApp.

The quotation basket should support multiple different products.

Example:

Quotation

Steel Sliding Gate
Quantity: 1

Steel Door
Quantity: 2

Window Grills
Quantity: 6

[Request Quote on WhatsApp]

The WhatsApp message should be structured and readable.

Example structure:

Hello TijwaWelders,

I would like to request a quotation for:

1. Steel Sliding Gate — Qty: 1
2. Steel Door — Qty: 2
3. Window Grills — Qty: 6

Please provide a quotation and advise on the next steps.

Thank you.

The implementation may include the product URL where useful.

10. Pricing

Do not build a complex pricing engine.

Some products may display:

A starting price
A price range
An indicative price
"Request a quotation"

Only use actual business-approved pricing/content.

The website must never pretend to calculate an exact fabrication price when the final price depends on:

Measurements
Material choice
Design
Finish
Installation
Site conditions
Quantity
Structural requirements
Customer requirements

The quotation request exists specifically to allow human pricing.

11. Design Philosophy

The visual direction should be inspired by the principles of premium technology/product websites such as Apple and Tesla:

Clarity
Strong hierarchy
Restraint
Excellent typography
Generous whitespace
Strong photography
Simple navigation
Clear calls to action
Minimal unnecessary decoration

Do NOT copy their branding, layouts, assets, or identity.

TijwaWelders must have its own visual identity.

The website should feel:

Professional
Industrial
Modern
Trustworthy
Precise
Premium
Practical

Avoid:

Excessive gradients
Decorative animations
Excessive shadows
Excessive cards
Huge text everywhere
Autoplay video
Unnecessary sliders
Popups
Fake urgency
Decorative UI that does not help the customer

Minimal design does not mean minimal information.

The underlying content should be comprehensive while the presentation remains simple.

12. Global Navigation

The navigation should remain simple.

Primary navigation should expose the most important customer destinations.

Recommended structure:

Home
Products
Projects
Services
Materials / Guides
About
Contact

The exact navigation implementation MUST reuse the existing monorepo navigation components.

On mobile, WhatsApp/contact actions should remain extremely easy to access.

A persistent mobile action area may be used if it fits the existing UI architecture and does not obscure content.

Possible actions:

WhatsApp
Call
Quote

Do not add a persistent bar if it creates usability or accessibility problems.

13. Homepage

The homepage must immediately communicate:

What TijwaWelders does
What customers can buy/request
That TijwaWelders works on real projects
How to request a quotation

The hero should be concise.

Conceptual direction:

TijwaWelders

Steel Fabrication Built for Real Projects.

Gates. Doors. Windows. Railings. Structures.
Custom metal fabrication.

[Explore Products]
[Get a Quote]

Do not overload the hero with paragraphs.

Use one strong, genuine TijwaWelders image where possible.

14. Homepage Section Structure

Recommended order:

Hero

Clear business proposition + primary actions.

Product categories

Show the major things TijwaWelders makes.

Examples:

Gates
Doors
Windows & Grills
Railings
Structural Fabrication
Commercial Fabrication
Custom Fabrication

Each category must link to a crawlable category page.

Featured products

Show selected real products.

Every product must link to its own crawlable URL.

Projects / Recent work

Show real fabrication work.

This section is extremely important.

It should not be a generic photo gallery.

Services

Briefly explain the services.

Link to full service content where appropriate.

Why TijwaWelders / trust section

Use only genuine claims.

Do not invent statistics.

Materials / educational content

Introduce useful educational topics.

Examples:

Steel tube sizes
Gauge 16 vs Gauge 18
Choosing steel for gates
Steel thickness
Fabrication materials
Contact / quotation CTA

Strong WhatsApp-first conversion.

15. Products Section

Products are one of the most important parts of the entire website.

Every meaningful product should have its own URL.

Example:

/products/gates/
/products/gates/steel-sliding-gate
/products/doors/steel-security-door
/products/windows/window-grills

The exact URL structure must follow existing routing conventions and SEO requirements.

Important product pages must be crawlable through normal links.

Do not make products accessible only through JavaScript filtering.

16. Product Category Pages

A category page should:

Explain the category
Show products
Help customers understand available options
Provide internal links
Support search discovery
Make quotation easy

Example:

Steel Gates

Introduction

[Product grid]

Steel Sliding Gates
Steel Pedestrian Gates
Steel Security Gates
Custom Gates

Related projects

Related services

Helpful guide

[Request a Quote]

Do not create dozens of meaningless category pages.

Every indexable page must have genuine user value.

17. Product Detail Page

Every product page MUST contain a quotation mechanism.

The product page should be structured approximately as:

Product title

Strong product image

Short value proposition

[Add to Quote]

Product overview

Key specifications

Available options / variations

Materials where relevant

Typical applications

Installation information where relevant

Pricing information if approved

Real project examples

Related products

Helpful educational content

FAQ where useful

[Request a Quote on WhatsApp]

The quotation CTA must be visible without forcing the user to search for it.

18. Product Page Content

Every product should provide useful information.

Possible fields:

Product name
Short description
Full description
Specifications
Applications
Material information
Finish information
Size information where appropriate
Installation information
Pricing/range if approved
Images
Related projects
Related products
SEO title
Meta description
Canonical URL where required

Do not fabricate technical specifications.

If a specification is not confirmed, do not invent it.

19. Product Images

Images are both a conversion asset and an SEO asset.

Every important product should have high-quality real images where available.

Images should be:

Properly compressed
Responsive
CDN-delivered
Correctly sized
Lazy-loaded when appropriate
Eagerly loaded when they are above the fold and important to LCP
Given meaningful filenames
Given meaningful alt text

Example filename:

steel-sliding-gate-tijwawelders-nairobi.webp

Avoid:

IMG_9384.jpg
image1.webp
DSC_1234.jpg

unless the original filename must be retained for technical reasons.

20. Image Alt Text

Alt text must describe the actual image.

For a product image:

Steel sliding gate by TijwaWelders

More descriptive where useful:

Black steel sliding gate installed at a residential property

Do not keyword stuff alt text.

Do not repeat the same artificial keyword phrase on every image.

Do not use:

best steel gate Nairobi steel gates Kenya cheap steel gate Nairobi

Alt text exists primarily for accessibility and image understanding.

It can also provide useful contextual information to search engines.

Decorative images should use appropriate empty alt text where required.

21. Project Section

Projects are a major credibility and SEO asset.

Do NOT build a generic gallery as the main project experience.

Build a real Projects system.

Each meaningful project should be capable of having its own page.

Example:

/projects/steel-gate-installation-project

A project page can include:

Project title
Project type
Location where appropriate
Work performed
Products involved
Services involved
Description
Materials where appropriate
Real project photographs
Completion information where appropriate
Related products
Related projects
Contact/quotation CTA

Only publish genuine projects.

Never invent:

Customers
Locations
Project values
Completion dates
Project statistics
Client names
Photographs
Testimonials
22. Project Images

Project images should receive the same SEO and performance treatment as product images.

Examples of useful alt text:

Steel gate fabricated and installed by TijwaWelders

or:

Steel structural fabrication completed for a commercial project

Alt text must describe what is actually visible.

23. Services

Services do not need to live in the database.

They can be implemented as static content/pages.

Potential services include:

Welding & Fabrication
Custom Metal Fabrication
Gate Fabrication
Steel Door Fabrication
Structural Steel Fabrication
Installation
Metal Repairs
Commercial Fabrication

Each service page should have a genuine purpose.

A service page should not exist solely because a keyword exists.

24. Locations

Locations do not need to live in the database.

Use static content/configuration such as JSON or the existing content architecture.

Do NOT automatically create hundreds of location pages.

Location pages should only be created where TijwaWelders has genuine service/project relevance and enough useful content.

Never generate fake location-specific content.

Do not create pages such as:

/gates/nairobi
/gates/ruiru
/gates/kiambu
/gates/thika
...

unless each page provides genuine additional value.

25. Materials / Education

Materials are intentionally NOT database entities.

The Materials section exists to educate customers.

Potential topics:

3/4 inch steel tube
1 inch steel tube
Common steel tube sizes
Gauge 16 vs Gauge 18
Steel sheet
Steel plate
Expanded metal
Steel sections
Finishes
Choosing steel for a gate
Choosing steel for a railing

The content must be technically responsible.

Do not publish universal gauge-to-millimetre conversions without confirming the relevant material/standard.

The Materials section should link naturally to relevant products.

Example:

Gauge 16 vs Gauge 18 Steel
        ↓
Steel Gates
Steel Doors
Window Grills

This creates useful topical relationships without requiring database complexity.

26. Testimonials

Testimonials are NOT database entities.

Only use genuine customer feedback.

Do not manufacture testimonials.

Do not create fake names or fake customer stories.

Testimonials are primarily a trust/conversion feature.

27. SEO — Highest Priority

SEO must influence the architecture from the beginning.

SEO must not be added after the UI is complete.

The implementation must consider:

Crawlability
Indexability
URL structure
Metadata
Headings
Internal linking
Canonicals
Sitemap
Robots
Structured data
Image SEO
Performance
Accessibility
Mobile usability
Content quality
Search intent

Google Search Central documentation is the authority for SEO implementation decisions.

Do not rely on unsupported SEO myths.

Do not keyword stuff.

Do not create pages purely to manipulate search results.

28. Search-Friendly URLs

URLs must be:

Stable
Descriptive
Human-readable
Lowercase
Simple
Consistent

Avoid unnecessary IDs and parameters in canonical product URLs.

Prefer:

/products/gates/steel-sliding-gate

over:

/product?id=2837

Do not casually change established URLs after indexing.

If URLs must change, implement appropriate redirects.

29. Internal Linking

Internal links are extremely important.

Products should link to:

Related products
Categories
Relevant projects
Relevant services
Relevant educational content

Projects should link to:

Related products
Related services
Relevant categories

Educational pages should link to:

Products
Services
Projects

Use normal crawlable links.

Important content must not be accessible exclusively through JavaScript click handlers.

30. Breadcrumbs

Use breadcrumbs where appropriate.

Example:

Home
  → Products
    → Gates
      → Steel Sliding Gate

Breadcrumbs should reflect the real site hierarchy.

Where appropriate, implement valid Breadcrumb structured data.

31. Structured Data

Implement structured data only where it accurately describes the page.

Potential types include:

Organization / LocalBusiness
Product
BreadcrumbList
Article where genuine article content exists
Other supported structured data types where applicable

Do not add structured data merely for decoration.

Do not mark up information that is not visible or truthful.

Structured data does not guarantee a rich result.

32. Local SEO

The business already has a Google Business Profile.

The website should support local discoverability through:

Consistent business information
LocalBusiness structured data where appropriate
Clear contact information
Service-area information
Genuine project/location information
Relevant product/service content
Strong internal linking
Fast mobile experience

Do not create artificial location pages.

Do not stuff city names into every heading, paragraph, filename, or alt attribute.

33. Metadata

Every important indexable page must have appropriate:

Title
Meta description
Canonical
Open Graph information where appropriate
Relevant structured data where appropriate

Titles and descriptions should describe the actual page.

Avoid duplicate metadata across important pages.

34. Headings

Each page must have a clear heading hierarchy.

Generally:

H1
 ├── H2
 │    ├── H3
 │    └── H3
 └── H2

Do not use headings merely for visual sizing.

Use the existing typography system for visual styling.

35. Search/Filtering

If product filtering is implemented, it must not compromise crawlability.

Filters are primarily a UX feature.

Do not automatically make every filter combination an indexable SEO page.

Avoid creating thousands of URL combinations.

Canonicalization and indexing strategy must be deliberate.

36. Performance

The website must be fast, especially on mobile networks.

Priorities:

Optimized images
Responsive images
Correct image dimensions
CDN delivery
Browser caching
Minimal JavaScript
Minimal unnecessary dependencies
Server-side rendering/static rendering where appropriate
Efficient fonts
No unnecessary animations
No oversized assets

Core Web Vitals should be treated as engineering requirements.

Pay particular attention to:

LCP
INP
CLS
37. Accessibility

The website must be accessible.

Requirements include:

Keyboard navigation
Visible focus states
Proper semantic HTML
Correct labels
Accessible forms
Sufficient contrast
Meaningful alt text
Proper button/link semantics
Accessible mobile navigation
Accessible quotation controls

Do not use clickable <div> elements where an actual button or link is appropriate.

38. Responsive Design

Mobile-first implementation is required.

The website must work properly across:

Small phones
Large phones
Tablets
Laptops
Desktop screens

Do not design desktop first and simply shrink it.

The quotation and WhatsApp experience must be particularly easy on mobile.

39. Quote Basket UX

The quote basket should feel like a lightweight quotation list, not a shopping cart.

Possible UI:

Your Quote

3 products selected

Steel Sliding Gate       × 1
Steel Door               × 2
Window Grills            × 6

[Continue Browsing]
[Request Quote on WhatsApp]

Allow:

Quantity increase
Quantity decrease
Remove product
Continue browsing
Clear quote

Do not add:

Payment
Checkout
Shipping
Tax calculations
Account creation
Complex cart logic

Persisting the basket in browser/client state is sufficient initially.

40. WhatsApp Message Generation

The generated WhatsApp message must be:

Clear
Structured
Human-readable
Short enough to be practical

It should include:

Greeting
Product names
Quantities
Optional displayed price/range where appropriate
Optional product URLs
Request for quotation
Request for next steps

Do not expose internal IDs or database implementation details.

41. Email

Email is secondary.

Provide email contact where appropriate:

Contact page
Footer
Contact CTA
Product/project contact area where useful

Do not make email the primary CTA when WhatsApp is available.

42. Contact Page

The contact page should be extremely simple.

Include:

Business identity
WhatsApp
Phone where applicable
Email
Service-area information
Business location information where appropriate
Contact/quote CTA

Do not force users through a long form when WhatsApp can solve the interaction faster.

43. About Page

The About page should establish:

Who TijwaWelders is
What the company does
Types of work
Fabrication capabilities
Approach to quality/workmanship
Relevant experience where genuinely documented

Avoid generic corporate filler.

Use real photography whenever possible.

44. Content Quality

Content must be:

Useful
Specific
Accurate
Original
Human-oriented
Relevant to fabrication customers

Do not generate large quantities of low-value pages.

AI may assist with content workflows, but published content must provide genuine value and must not fabricate facts.

45. Admin Content Management

The admin should be able to manage the actual dynamic entities:

Categories
Create
Edit
Publish/unpublish
Order where required
Products
Create
Edit
Publish/unpublish
Assign category
Manage images
Manage SEO metadata
Manage quotation information
Projects
Create
Edit
Publish/unpublish
Manage project images
Manage relevant product relationships if implemented
Manage SEO metadata
Project images
Upload
Reorder
Replace
Delete
Add meaningful alt text

Keep the admin interface simple.

46. Database Safety

Before changing Prisma:

Inspect the current schema.
Understand existing models.
Identify reusable models.
Identify actual missing requirements.
Make the smallest necessary schema change.
Validate relationships.
Validate migrations.
Test existing functionality.

Never replace the existing schema simply to match this document.

This document describes the intended minimal architecture, not permission to destroy existing working infrastructure.

47. Image Infrastructure

Use the existing image/file infrastructure in the monorepo.

If Cloudinary is already integrated, reuse that implementation.

Do not create a second image-upload system.

Images should support:

Responsive delivery
Transformation
Compression
CDN delivery
Appropriate formats
Correct dimensions
Meaningful filenames
Meaningful alt text
Lazy loading where appropriate
48. No Fake Content

Never invent:

Projects
Customers
Testimonials
Locations
Business statistics
Product specifications
Prices
Certifications
Years of experience
Awards
Reviews

If content is missing, use an appropriate empty state or request the real content.

49. Section-Level Design Rule

Every major section must answer a customer question.

Examples:

Products

"What can I get from TijwaWelders?"

Product detail

"What exactly is this, and how do I request it?"

Projects

"Has TijwaWelders actually done this type of work?"

Services

"What fabrication service do I need?"

Materials

"What does this steel/material specification mean?"

Contact

"How do I reach TijwaWelders?"

Quote

"What do I want quoted?"

Do not create sections simply because they are common on other websites.

50. Primary Customer Journey

The entire website should support:

Google / Search
      ↓
Relevant landing page
      ↓
Product / Project / Service
      ↓
Understand
      ↓
Trust
      ↓
Add product to quote
      ↓
Continue browsing
      ↓
Review quote
      ↓
WhatsApp
      ↓
Human quotation

This journey should remain obvious throughout the website.

51. SEO + Conversion Must Work Together

Do not treat SEO and conversion as separate systems.

A product page should simultaneously:

Rank for relevant searches
Answer customer questions
Show real work
Build trust
Provide internal links
Give the customer a clear quotation path

The product page is both an SEO landing page and a conversion page.

52. Final Development Rule

Before implementing any feature, ask:

Does the customer need it?
Does it improve discoverability?
Does it improve understanding?
Does it improve quotation/contact?
Does it reuse existing infrastructure?
Does it add unnecessary complexity?
Does it require database persistence?
Does it maintain performance?
Does it remain accessible?
Does it create unnecessary indexable URLs?

If a feature does not justify itself, do not build it.

53. Definition of Done

A TijwaWelders feature is not complete merely because it renders visually.

It is complete only when:

It uses the existing UI system.
It follows the monorepo architecture.
It does not duplicate existing infrastructure.
It is responsive.
It is accessible.
It is performant.
It is SEO-aware.
It has appropriate metadata where applicable.
Images are optimized.
Images have appropriate alt text.
Important links are crawlable.
URLs are stable and meaningful.
The WhatsApp conversion path works where applicable.
Database changes are minimal and justified.
No fake business information has been introduced.
54. Final Product Principle

TijwaWelders should feel like a professional fabrication company with a very good digital showroom and quotation system, not like a complicated ecommerce application.

The customer should always understand:

What TijwaWelders makes → What it looks like → Whether it fits their need → How to request a quotation.