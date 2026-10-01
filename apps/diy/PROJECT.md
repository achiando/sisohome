DIY — EXPANDED PRODUCT CATALOG & PROJECTS REQUIREMENTS

1. DIY IS A BROAD TECHNICAL PRODUCT + PROJECT PLATFORM

Do not design DIY as only a hardware/tools store.

DIY should support a broad catalog covering:

DIY tools
workshop equipment
electrical equipment
electronics components
electronic modules
sensors
automation components
wiring and cables
connectors
switches
power supplies
batteries and power accessories
soldering equipment
prototyping equipment
robotics components
maker equipment
measurement equipment
safety equipment
hardware and accessories
consumables
replacement parts
kits
project materials
other legitimate DIY/technical products

In addition to products, DIY must have a Projects section.

Projects demonstrate what customers can build, repair, automate, prototype, or create using products available through DIY.

The three major content pillars are:

Products
Projects
Guides

These must work together.

2. CORE CUSTOMER JOURNEY

The platform should support several discovery journeys.

Product-first
Search
↓
Product
↓
Understand
↓
Add to Quote
↓
WhatsApp
Project-first
Search
↓
Project
↓
Understand What Is Needed
↓
Discover Required Products
↓
Add Products to Quote
↓
WhatsApp
Educational-first
Search
↓
Guide
↓
Learn
↓
Discover Products
↓
Add to Quote
↓
WhatsApp

This creates a connected product ecosystem rather than three disconnected sections.

3. DIY SITE STRUCTURE

The primary public structure should include:

Home
Products
Projects
Guides
About
Contact
Quote

The exact navigation can be adapted to the existing application design system.

Primary conversion action:

Get a Quote

4. PRODUCTS

Products remain the main commercial catalog.

Product categories may include:

Tools & Workshop
Hand Tools
Power Tools
Workshop Equipment
Measuring Tools
Cutting Tools
Grinding Tools
Soldering Equipment
Tool Accessories
Consumables
Electronics Components
Resistors
Capacitors
Inductors
Diodes
LEDs
Transistors
MOSFETs
ICs
Regulators
Relays
Fuses
Crystals & Oscillators
Potentiometers
Thermistors
Optocouplers
Sensors
Temperature Sensors
Humidity Sensors
Motion Sensors
Proximity Sensors
Light Sensors
Infrared Sensors
Ultrasonic Sensors
Pressure Sensors
Gas Sensors
Current Sensors
Voltage Sensors
Distance Sensors
Hall Effect Sensors
Accelerometers
Gyroscopes
Magnetic Sensors
Modules & Boards
Microcontroller Boards
Development Boards
Relay Modules
Sensor Modules
Motor Driver Modules
Display Modules
Communication Modules
Power Modules
RF Modules
Bluetooth Modules
Wi-Fi Modules
GSM/Cellular Modules
Electrical
Switches
Sockets
Plugs
Connectors
Terminal Blocks
Circuit Protection
Power Supplies
Transformers
Batteries
Battery Holders
DC-DC Converters
AC-DC Supplies
Cables
Wires
Cable Accessories
Prototyping
Breadboards
Jumper Wires
Headers
PCB Accessories
Perfboards
Prototype Boards
Enclosures
Heat Shrink
Solder
Flux
Connectors
Robotics & Automation
Motors
Servo Motors
Stepper Motors
Motor Drivers
Actuators
Wheels
Gearboxes
Robot Chassis
Encoders
Controllers
Automation Components

These are examples only.

Build categories around the actual business catalog.

5. TECHNICAL PRODUCTS

The product architecture must support everything from:

10kΩ resistor

to:

18V cordless drill

without creating separate database systems.

Do not create models such as:

Resistor
Capacitor
Sensor
Motor
IC
Tool
PowerSupply
Connector

Instead, maintain a unified product model with flexible structured specifications.

6. PRODUCT TECHNICAL ATTRIBUTES

Technical specifications should adapt to the product.

Examples:

Resistor
Resistance
Tolerance
Power Rating
Type
Package
Quantity/pack size
Capacitor
Capacitance
Voltage Rating
Type
Tolerance
Package
Sensor
Sensor Type
Measurement Range
Operating Voltage
Interface
Accuracy
Response Time
Package/Module Type
Development Board
Microcontroller
Operating Voltage
Input Voltage
Digital I/O
Analog Inputs
Communication Interfaces
Dimensions
Motor
Motor Type
Voltage
Current
Speed
Torque
Shaft Diameter
Dimensions
Power Supply
Input Voltage
Output Voltage
Output Current
Power
Connector
Regulation Type
Tool
Voltage
Power
Speed
Capacity
Dimensions
Weight
Included Accessories

Only publish specifications supported by actual product information.

7. FLEXIBLE PRODUCT SPECIFICATIONS

Do not create database columns for every possible technical specification.

Avoid:

voltage
current
resistance
capacitance
tolerance
power
speed
torque
sensorRange
frequency
...

Use the existing project's flexible metadata/JSON architecture if available.

If the existing architecture has no suitable mechanism, inspect it before introducing one.

Do not build unnecessary abstraction.

Specifications should still be structured and renderable.

8. PRODUCT VARIANTS

The catalog may contain variants.

Examples:

10Ω
100Ω
1kΩ
10kΩ
100kΩ

or:

10µF
47µF
100µF
470µF

or:

2-pin
3-pin
4-pin
6-pin

or different:

voltage
size
capacity
package
color
connector
model

Only introduce a dedicated product-variant model when variants genuinely require independent:

SKU
price
availability
specifications
images

Do not build a complex variant engine unnecessarily.

9. QUANTITY AND PACK SIZE

The quote system must support technical-component quantities.

Examples:

10kΩ Resistor — Qty: 20

100µF Capacitor — Qty: 10

HC-SR04 Sensor — Qty: 3

Arduino-compatible board — Qty: 1

5m Hook-up Wire — Qty: 2

Products may be sold as:

Each
Pair
Pack
Set
Meter
Roll
Kit

Clearly distinguish pack size from requested quantity.

10. PRODUCT PAGES

Product pages must work as:

product information pages
SEO landing pages
quotation entry points

Recommended structure:

Breadcrumb
Product title
Short value proposition
Primary image
Gallery
Price/range if available
Pack/unit information
Quantity selector
Add to Quote
Overview
Specifications
Applications
Compatibility where relevant
Included items
Related products
Related projects
Related guides
Final WhatsApp CTA 11. PROJECTS ARE A CORE DIY CONTENT TYPE

Projects must NOT be treated as generic blog posts.

Projects should demonstrate practical things customers can build, repair, automate, prototype, or create.

Examples might include:

Arduino projects
Sensor projects
Robotics projects
Home automation projects
LED projects
Power supply projects
Electronics prototypes
Security projects
Workshop projects
DIY tools
Educational electronics projects
IoT projects
Motor-control projects
Solar/electrical projects
Repair projects

Only create projects that are genuinely supported by the business/content.

12. PROJECT DATABASE MODEL

DIY Projects should be a first-class database entity if the existing architecture requires admin-managed projects.

Conceptually:

DiyProject

with only the fields genuinely required.

Potential fields:

id
title
slug
shortDescription
description
featured
published
sort/order
createdAt
updatedAt

Use the existing project/content conventions if they already exist.

Do not blindly duplicate an existing generic Project model.

13. PROJECT IMAGES

Projects should support multiple images.

Conceptually:

DiyProjectImage

Potential information:

projectId
image reference
alt text
order
dimensions where supported by existing infrastructure

Reuse the existing image/CDN infrastructure.

Do not build another image pipeline.

14. PROJECT ↔ PRODUCT RELATIONSHIP

This is particularly important.

A project should be able to identify the products/components used or recommended for the project.

For example:

Automatic Plant Watering System

Required products:

Arduino-compatible board
Soil moisture sensor
Relay module
Water pump
Tubing
Jumper wires
Power supply

The project page should be able to link directly to those products.

The user can then add one or multiple required products to their quote.

15. PROJECT PRODUCT LIST

A project page should have a clear section such as:

What You Need
Product Quantity
Arduino-compatible board 1
Soil moisture sensor 1
Relay module 1
Water pump 1

Each product should link to its product page.

Where appropriate, provide:

Add to Quote

or:

Add Project Items to Quote

This allows a project to become a natural commercial conversion path.

16. ADD PROJECT TO QUOTE

Where the required products are available, provide:

Add Project to Quote

The system should:

Identify the project's associated products.
Add the required quantities to the quote basket.
Preserve existing quote items.
Allow the customer to modify quantities.
Allow the customer to remove individual products.
Allow the customer to continue browsing.
Allow the customer to send the complete quote to WhatsApp.

Do not create an order.

Do not create a backend quote record.

17. PROJECT PAGE STRUCTURE

A project page should be an excellent standalone landing page.

Recommended:

Breadcrumb

Home → Projects → Electronics Projects → Automatic Plant Watering System

Hero

Project title

Short description

Strong genuine project image

Project overview

What the project does.

What You Need

Required components/products.

How It Works

Clear explanation.

Build Steps

Step-by-step instructions where appropriate.

Products Used

Links to actual products.

Images

Real project/build imagery.

Related Guides

Educational content.

Related Projects

Other relevant projects.

CTA

Add Project to Quote

and:

Request a Quote on WhatsApp

18. PROJECTS MUST BE USEFUL, NOT THIN SEO PAGES

Do not generate project pages simply to create more URLs.

A project should provide genuine value.

A useful project page should contain meaningful information such as:

objective
components
process
explanation
images
applications
relevant products
relevant guides

Do not create dozens of nearly identical project pages.

Quality matters more than project count.

19. PROJECT SEO

Projects should be crawlable and indexable when they contain substantial useful content.

Each project should have:

unique title
unique meta description
canonical URL
H1
meaningful introduction
structured headings
internal links
optimized images
BreadcrumbList where appropriate
relevant structured data only when justified

Example URL:

/projects/automatic-plant-watering-system

or:

/projects/electronics/automatic-plant-watering-system

Use one stable architecture.

Do not expose database IDs.

20. PROJECT IMAGE SEO

Every project image must have:

descriptive filename
meaningful alt text
optimized dimensions
responsive delivery
CDN delivery where available
appropriate lazy loading

Example filename:

automatic-plant-watering-system-arduino.jpg

Example alt text:

Arduino-based automatic plant watering system with soil moisture sensor

Never use keyword-stuffed alt text.

21. PROJECTS ↔ GUIDES

Projects and Guides should complement each other.

Example:

Project

Build an Automatic Plant Watering System

Related guides:

What is a soil moisture sensor?
How relay modules work
Choosing an Arduino-compatible board
Understanding DC pumps

The guide should link back to the project where appropriate.

22. PROJECTS ↔ PRODUCTS

Product pages should be able to link to relevant projects.

For example:

HC-SR04 Ultrasonic Sensor

Used in these projects

Ultrasonic distance meter
Parking distance indicator
Obstacle detection robot

This creates strong internal linking and helps customers understand practical use cases.

23. PROJECT CATEGORIES

Project categories should be created only when useful.

Potential categories:

Electronics Projects
Arduino Projects
Robotics Projects
IoT Projects
Automation Projects
Electrical Projects
Workshop Projects
Beginner Projects

Do not create categories simply for SEO.

24. PROJECT CONTENT SAFETY

Technical projects must be accurate and appropriately responsible.

Be especially careful with projects involving:

mains electricity
high voltage
batteries
high current
heat
motors
power tools
hazardous materials

Do not provide unsafe instructions as if they are universally safe.

Where appropriate, clearly state safety requirements.

25. HOMEPAGE STRUCTURE

The homepage should now include Projects as a major storytelling element.

Recommended:

1. Hero

What DIY provides.

2. Shop by Category

Major product families.

3. Featured Products

Curated products.

4. Projects

Real/useful things customers can build.

Example:

Build Something With It.

Show 3–6 strong projects.

Each project should connect to its required products.

5. Guides

Educational content.

6. Why DIY

Short trust/value proposition.

7. Final CTA

Have something in mind?

Request a Quote on WhatsApp

The exact section order can evolve based on actual content.

26. PROJECTS HUB

Recommended:

/projects

Structure:

Breadcrumb
H1 — Projects
Intro
Featured project
Project categories where useful
Project grid
Related products
Guides
Quote CTA

Project cards should show:

strong image
project title
short description
category
View Project

Do not overload cards with technical details.

27. PROJECT DISCOVERY

Users should be able to reach projects from:

main navigation
homepage
products
product detail pages
guides
search
related content

Important project pages must be reachable through normal crawlable links.

28. SEARCH MUST COVER PRODUCTS + PROJECTS + GUIDES

Search should not only return products.

A search for:

ultrasonic sensor

could return:

Products
HC-SR04 Ultrasonic Sensor
Projects
Ultrasonic Distance Meter
Obstacle Detection Robot
Guides
How Ultrasonic Sensors Work

This creates a much stronger discovery experience.

Reuse the existing search architecture where possible.

29. INTERNAL LINKING ARCHITECTURE

The site should form a connected knowledge/product graph:

Projects
↕
Products
↕
Guides
↕
Categories

Example:

Project
↓
Required Products
↓
Product Pages
↓
Related Projects
↓
Guides

This should be deliberate.

30. DATABASE MODEL

Keep the database minimal.

Conceptually:

Admin/Auth

DIY
├── DiyCategory
├── DiyProduct
├── DiyProductImage
├── DiyProject
└── DiyProjectImage

Potentially:

DiyProduct
↓
DiyProductVariant

only if actual catalog requirements justify it.

And potentially an explicit product/project relationship if the existing Prisma architecture requires one.

Do NOT create:

DiyCustomer
DiyQuote
DiyOrder
DiyPayment
DiyCheckout
DiyInventory
DiyReview
DiyTestimonial

unless a future requirement explicitly calls for them.

31. PRODUCT ↔ PROJECT RELATIONSHIP IMPLEMENTATION

Before creating a new join table, inspect the existing Prisma architecture.

If a many-to-many relationship is genuinely required, a minimal relationship can conceptually be:

DiyProject
↕
DiyProjectProduct
↕
DiyProduct

The relationship may optionally contain:

quantity
required/recommended status
notes
order

For example:

Project:
Automatic Plant Watering System

Products:
Arduino-compatible board — 1 — required
Soil moisture sensor — 1 — required
Relay module — 1 — required
Water pump — 1 — required
Jumper wires — 1 — recommended

Only implement these fields if the real product/project experience needs them.

Do not add a join table simply because it is theoretically possible.

32. QUOTE FLOW FROM PROJECTS

The quote system must support project-originated products.

Example:

Customer visits:

Automatic Plant Watering System

Clicks:

Add Project to Quote

Quote becomes:

Arduino-compatible board × 1
Soil moisture sensor × 1
Relay module × 1
Water pump × 1

Customer can:

modify quantities
remove products
add other products
continue shopping

Then:

Request Quote on WhatsApp

The WhatsApp message should identify that the products came from a project where useful.

Example:

Hello, I would like a quotation for the products needed for the Automatic Plant Watering System:

Arduino-compatible board — Qty 1
Soil moisture sensor — Qty 1
Relay module — Qty 1
Water pump — Qty 1

Please provide a quotation and availability.

Do not send internal IDs.

33. PROJECTS ARE NOT ORDERS

A project represents:

Something a customer can build or learn from.

It does NOT represent:

a customer order
a customer
a quotation
a transaction
a completed sale

Keep this distinction clear in both the database and application architecture.

34. ADMIN PROJECT MANAGEMENT

Admins should be able to:

create project
edit project
publish/unpublish project
feature project
assign project category where supported
add project images
define project description
define project steps
associate products
specify required/recommended products
specify quantities
order project products
preview project

Reuse the existing admin infrastructure.

Do not build a separate admin application.

35. NO FAKE PROJECTS

Never fabricate:

projects
project images
build results
measurements
customer names
project locations
performance claims
testimonials
product compatibility

Development placeholders must be clearly identifiable and must not accidentally ship as real content.

36. PERFORMANCE

Projects may contain multiple images.

Therefore:

use responsive images
use optimized formats
use CDN delivery
lazy-load non-critical images
prioritize the hero image
avoid loading entire galleries immediately
provide correct dimensions
prevent layout shifts

Do not turn project pages into image-heavy performance problems.

37. FINAL EXPERIENCE

DIY should ultimately feel like:

A place to discover what you need, understand what you can build, find the components/tools required, and request everything through one simple WhatsApp quotation.

The customer should be able to start from:

Product

or:

Project

or:

Guide

and naturally reach the same conversion:

Discover
↓
Understand
↓
Choose Products
↓
Add to Quote
↓
WhatsApp
↓
Human quotation/follow-up

The catalog can contain thousands of highly technical products.

The customer experience must remain simple.

The database must remain minimal.

The architecture must remain reusable.

The project system must strengthen product discovery and SEO rather than becoming a disconnected blog.

Products + Projects + Guides should operate as one connected DIY ecosystem.
