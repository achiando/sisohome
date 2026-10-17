# SisoHome — Second-Layer Architecture and Prisma Implementation Plan

Your decisions establish a clear operating model:

- Individual landlords use their own `Organization` workspace with `OrganizationType.INDIVIDUAL`.
- Property management companies have separate organization workspaces and access a landlord's properties through explicit management agreements.
- Your existing RBAC remains the authorization foundation. We extend its application to property-level access; we do not create a competing role and permission system.

My recommendation is to implement SisoHome as a modular property-management domain on top of your existing PostgreSQL and Prisma foundation.

The most important design decision is that a property has an organization responsible for its SisoHome operational record, but legal ownership, management authority and user access are separate relationships. This allows a management company to manage a landlord's properties without becoming the owner or gaining unrestricted access to the landlord's other assets.

## 1. Target architecture

\#chatgpt-mermaid-\_r_ha\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_ha\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_ha\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_ha\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_ha\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ha\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_ha\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_ha\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_ha\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_ha\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_ha\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_ha\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ha\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ha\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_ha\_ p{margin:0;}#chatgpt-mermaid-\_r_ha\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ha\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ha\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ha\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_ha\_ .label text,#chatgpt-mermaid-\_r_ha\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ha\_ .node rect,#chatgpt-mermaid-\_r_ha\_ .node circle,#chatgpt-mermaid-\_r_ha\_ .node ellipse,#chatgpt-mermaid-\_r_ha\_ .node polygon,#chatgpt-mermaid-\_r_ha\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_ha\_ .rough-node .label text,#chatgpt-mermaid-\_r_ha\_ .node .label text,#chatgpt-mermaid-\_r_ha\_ .image-shape .label,#chatgpt-mermaid-\_r_ha\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_ha\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_ha\_ .rough-node .label,#chatgpt-mermaid-\_r_ha\_ .node .label,#chatgpt-mermaid-\_r_ha\_ .image-shape .label,#chatgpt-mermaid-\_r_ha\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_ha\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_ha\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ha\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ha\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_ha\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_ha\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_ha\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_ha\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_ha\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_ha\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_ha\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ha\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ha\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_ha\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ha\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_ha\_ .icon-shape,#chatgpt-mermaid-\_r_ha\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_ha\_ .icon-shape p,#chatgpt-mermaid-\_r_ha\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_ha\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_ha\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_ha\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_ha\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_ha\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_ha\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_ha\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_ha\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_ha\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ha\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_ha\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_ha\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_ha\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ha\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_ha\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_ha\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ha\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_ha\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_ha\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ha\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_ha\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ha\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_ha\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_ha\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_ha\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_ha\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_ha\_ .node rect,#chatgpt-mermaid-\_r_ha\_ .node circle,#chatgpt-mermaid-\_r_ha\_ .node ellipse,#chatgpt-mermaid-\_r_ha\_ .node polygon,#chatgpt-mermaid-\_r_ha\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_ha\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_ha\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_ha\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_ha\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ha\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}SisoHome property domainExisting foundation — preserveProperty PortfolioOwnership RecordsManagement AgreementsBuildings and UnitsTenants, Leases andAgreementsRent, Payments and ExpensesMaintenance and Work OrdersUtilities and Service ProvidersDocument Metadata andVersionsReportingUser and SessionOrganizationMembership, Roles andPermissionsResource RelationshipsAudit Logsaudit eventsscoped access where appropriate

The modules share one database initially. Each module should have a defined responsibility, and the domain relationships should be explicit and relational wherever they represent important business facts.

## 2. The ownership and management model

This is the core of the architecture. I recommend treating the landlord's workspace as the primary property portfolio, while granting management companies scoped access through their management agreements.

\#chatgpt-mermaid-\_r_hj\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_hj\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_hj\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_hj\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_hj\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_hj\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_hj\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_hj\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_hj\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_hj\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_hj\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_hj\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_hj\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_hj\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_hj\_ p{margin:0;}#chatgpt-mermaid-\_r_hj\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_hj\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_hj\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_hj\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_hj\_ .label text,#chatgpt-mermaid-\_r_hj\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_hj\_ .node rect,#chatgpt-mermaid-\_r_hj\_ .node circle,#chatgpt-mermaid-\_r_hj\_ .node ellipse,#chatgpt-mermaid-\_r_hj\_ .node polygon,#chatgpt-mermaid-\_r_hj\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_hj\_ .rough-node .label text,#chatgpt-mermaid-\_r_hj\_ .node .label text,#chatgpt-mermaid-\_r_hj\_ .image-shape .label,#chatgpt-mermaid-\_r_hj\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_hj\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_hj\_ .rough-node .label,#chatgpt-mermaid-\_r_hj\_ .node .label,#chatgpt-mermaid-\_r_hj\_ .image-shape .label,#chatgpt-mermaid-\_r_hj\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_hj\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_hj\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_hj\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_hj\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_hj\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_hj\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_hj\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_hj\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_hj\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_hj\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_hj\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_hj\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_hj\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_hj\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_hj\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_hj\_ .icon-shape,#chatgpt-mermaid-\_r_hj\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_hj\_ .icon-shape p,#chatgpt-mermaid-\_r_hj\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_hj\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_hj\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_hj\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_hj\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_hj\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_hj\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_hj\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_hj\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_hj\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_hj\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_hj\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_hj\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_hj\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_hj\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_hj\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_hj\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_hj\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_hj\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_hj\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_hj\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_hj\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_hj\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_hj\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_hj\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_hj\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_hj\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_hj\_ .node rect,#chatgpt-mermaid-\_r_hj\_ .node circle,#chatgpt-mermaid-\_r_hj\_ .node ellipse,#chatgpt-mermaid-\_r_hj\_ .node polygon,#chatgpt-mermaid-\_r_hj\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_hj\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_hj\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_hj\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_hj\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_hj\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Landlord OrganizationProperty ManagementOrganizationPropertyProperty OwnershipProperty ManagementAgreementUnitsLeases and Tenants

### Example

Suppose an individual landlord owns Greenfield Apartments and Cedar Ridge Apartments. They have a workspace with `OrganizationType.INDIVIDUAL`.

A separate property management company manages Greenfield Apartments, but not Cedar Ridge Apartments.

- The landlord's organization remains the owner of record in SisoHome.
- Greenfield has an active management agreement with the management company.
- Cedar Ridge has no such agreement.
- The management company's authorized staff can access Greenfield within the agreement's scope.
- They cannot access Cedar Ridge simply because they belong to the management company.
- The landlord retains the reporting and oversight access assigned to them.

This is the intended behavior, not merely a UI restriction.

### Important ownership decision

Use the existing `Organization` model for the owner identity. Avoid introducing a second `Owner` entity solely to represent individual landlords.

Add a `PropertyOwnership` relationship between a property and an owning organization. That supports individual landlords today and organizations that own property in the future.

A property's primary workspace should be explicit. I recommend a required `portfolioOrganizationId` on `Property` identifying the organization that holds its canonical operational record. Under the initial model, this will normally be the owner's workspace. Ownership records remain the authoritative record of who owns the property.

If ownership changes, do not silently transfer or duplicate the property's history. Record the ownership change and determine how historical financial, tenancy and management records remain accessible.

## 3. Refined domain model

The following is the target model inventory. It deliberately separates essential first-release models from later expansion.

## Phase 1 — Portfolio and tenancy foundation

Implement first

- `Property` — canonical property record and portfolio organization.
- `PropertyOwnership` — ownership relationships and effective dates.
- `PropertyManagementAgreement` — owner-to-manager authorization, dates and scope.
- `Building` — optional physical subdivision of a property.
- `UnitType` — reusable unit classifications.
- `Unit` — individual rentable or usable spaces.
- `PropertyStaffAssignment` — caretaker, manager and other internal assignments.
- `Tenant` — tenant business identity, separate from `User`.
- `Lease`, `LeaseTenant`, `LeaseUnit` — agreement and participant relationships.
- `LeaseDocument` and `DocumentVersion` — agreement files and version history.

## Phase 2 — Financial and operational records

- `RentCharge`, `Payment`, `PaymentAllocation` and deposit ledger records.
- `Expense`, `ExpenseApproval` and financial adjustment records.
- `MaintenanceTicket`, `WorkOrder`, `WorkOrderAssignment` and `WorkOrderVisit`.
- `ServiceProvider`, `ServiceAgreement`, `ServiceSchedule` and `ServiceOccurrence`.
- `UtilityBill` and `UtilityChargeAllocation`.

## Phase 3 — Portals and advanced operations

- Tenant portal identity links and invitations.
- Provider staff and technician availability.
- Preventive maintenance plans and asset registers.
- Automated notifications, recurring jobs and scheduled statements.
- Reconciled reporting projections and advanced analytics.

The inventory is not a requirement to create every model immediately. For example, provider invoices can initially use a well-designed expense model if they do not need a distinct payable workflow. We should avoid duplicate concepts that do not yet represent different business behavior.

## 4. Proposed Prisma schema shape

I would add the new models alongside your existing models, keeping your current naming conventions and database mappings.

The following snippets illustrate the most important relationships. They are design fragments, not a complete drop-in schema; relation fields and inverse fields need to be reconciled across the full schema before running Prisma validation.

### A. Property, ownership and management

```
enum PropertyStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

enum OwnershipStatus {
  ACTIVE
  ENDED
}

enum ManagementAgreementStatus {
  DRAFT
  ACTIVE
  SUSPENDED
  ENDED
  TERMINATED
}

model Property {
  id                     String         @id @default(uuid()) @db.Uuid
  portfolioOrganizationId String        @map("portfolio_organization_id") @db.Uuid
  name                   String
  code                   String?
  description            String?
  status                 PropertyStatus @default(ACTIVE)

  addressLine1           String         @map("address_line1")
  addressLine2           String?        @map("address_line2")
  city                   String
  state                  String?
  postalCode             String?        @map("postal_code")
  country                String
  latitude               Decimal?       @db.Decimal(10, 7)
  longitude              Decimal?       @db.Decimal(10, 7)

  createdAt              DateTime       @default(now()) @map("created_at")
  updatedAt              DateTime       @updatedAt @map("updated_at")

  portfolioOrganization  Organization   @relation(
    fields: [portfolioOrganizationId],
    references: [id],
    onDelete: Restrict
  )

  ownerships             PropertyOwnership[]
  managementAgreements   PropertyManagementAgreement[]
  buildings              Building[]
  units                  Unit[]

  @@unique([portfolioOrganizationId, code])
  @@index([portfolioOrganizationId, status])
  @@map("properties")
}

model PropertyOwnership {
  id                   String    @id @default(uuid()) @db.Uuid
  propertyId           String    @map("property_id") @db.Uuid
  ownerOrganizationId  String    @map("owner_organization_id") @db.Uuid
  ownershipPercentage  Decimal?  @map("ownership_percentage") @db.Decimal(5, 2)
  startsAt             DateTime  @map("starts_at")
  endsAt               DateTime? @map("ends_at")
  createdAt            DateTime  @default(now()) @map("created_at")

  property             Property     @relation(
    fields: [propertyId], references: [id], onDelete: Restrict
  )
  ownerOrganization    Organization @relation(
    fields: [ownerOrganizationId], references: [id], onDelete: Restrict
  )

  @@index([propertyId, startsAt, endsAt])
  @@index([ownerOrganizationId])
  @@map("property_ownerships")
}

model PropertyManagementAgreement {
  id                       String @id @default(uuid()) @db.Uuid
  propertyId               String @map("property_id") @db.Uuid
  ownerOrganizationId      String @map("owner_organization_id") @db.Uuid
  managementOrganizationId String @map("management_organization_id") @db.Uuid

  status                   ManagementAgreementStatus @default(DRAFT)
  startsAt                 DateTime  @map("starts_at")
  endsAt                   DateTime? @map("ends_at")
  scope                    Json?
  contractDocumentId       String?   @map("contract_document_id") @db.Uuid

  createdAt                DateTime  @default(now()) @map("created_at")
  updatedAt                DateTime  @updatedAt @map("updated_at")

  property                 Property     @relation(
    fields: [propertyId], references: [id], onDelete: Restrict
  )
  ownerOrganization        Organization @relation(
    fields: [ownerOrganizationId], references: [id], onDelete: Restrict
  )
  managementOrganization   Organization @relation(
    fields: [managementOrganizationId], references: [id], onDelete: Restrict
  )

  @@index([propertyId, status])
  @@index([ownerOrganizationId, status])
  @@index([managementOrganizationId, status])
  @@map("property_management_agreements")
}
```

Design notes:

- `portfolioOrganizationId` is the canonical operational workspace, not a substitute for ownership.
- `PropertyOwnership` supports multiple owners and changes over time.
- `PropertyManagementAgreement` explicitly authorizes the management relationship.
- `scope` can hold agreement-specific configuration initially, but critical access rules should not exist only inside unvalidated JSON.
- `@@unique([portfolioOrganizationId, code])` allows multiple null codes in PostgreSQL. If a code is provided, it should be unique within that portfolio.

The schema must also validate that the owner organization recorded on a management agreement is an actual owner of the property during the applicable period. A normal foreign key cannot enforce this temporal business rule by itself.

I would not use a single permanent `managementOrganizationId` on `Property`. The management agreement is the better place to represent changing management arrangements.

### B. Buildings, unit types and units

```
model Building {
  id         String   @id @default(uuid()) @db.Uuid
  propertyId String   @map("property_id") @db.Uuid
  name       String
  code       String?
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  property Property @relation(
    fields: [propertyId], references: [id], onDelete: Restrict
  )
  units    Unit[]

  @@unique([propertyId, code])
  @@index([propertyId])
  @@map("buildings")
}

model UnitType {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String?  @map("organization_id") @db.Uuid
  name           String
  slug           String
  description    String?
  createdAt      DateTime @default(now()) @map("created_at")

  units Unit[]

  @@unique([organizationId, slug])
  @@map("unit_types")
}

model Unit {
  id          String   @id @default(uuid()) @db.Uuid
  propertyId  String   @map("property_id") @db.Uuid
  buildingId  String?  @map("building_id") @db.Uuid
  unitTypeId  String?  @map("unit_type_id") @db.Uuid
  code        String
  floor       String?
  description String?
  status      String   @default("AVAILABLE")
  askingRent  Decimal? @map("asking_rent") @db.Decimal(12, 2)
  currency    String   @default("KES")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  property Property @relation(
    fields: [propertyId], references: [id], onDelete: Restrict
  )
  building  Building? @relation(fields: [buildingId], references: [id], onDelete: Restrict)
  unitType  UnitType? @relation(fields: [unitTypeId], references: [id], onDelete: Restrict)

  @@unique([propertyId, code])
  @@index([propertyId, status])
  @@index([unitTypeId])
  @@map("units")
}
```

I would replace the illustrative string `status` with a proper enum before implementation. The same applies to other lifecycle fields throughout the proposed domain.

The optional building relationship supports both direct units within a property and units inside buildings. One additional invariant is needed: if a unit has a building, that building must belong to the same property. Two ordinary foreign keys do not guarantee that both references are mutually consistent.

### C. Tenant and lease relationships

The core shape should be:

```
Tenant
  ├── LeaseTenant ── Lease
  └── User link(s), when portal access is established

Lease
  ├── LeaseTenant ── Tenant
  ├── LeaseUnit ── Unit
  ├── LeaseDocument ── DocumentVersion
  ├── RentCharge
  └── LeaseEvent
```

The lease itself should hold the agreement's dates, status, payment frequency, currency and applicable contractual terms. The agreed rent should be represented by a lease charge or rent schedule, rather than being read from `Unit.askingRent`.

I would also add a tenant-to-user identity link with a unique constraint appropriate to your account model. Do not add a mandatory `userId` directly to `Tenant`: a tenant can exist before portal registration, and joint tenancy may involve multiple people.

For the signed agreement, use private object storage with metadata in PostgreSQL. Do not store the entire file as a public URL or expose a storage key as authorization. Every download should check the caller's access to the lease and document.

## 5. Preserve and strengthen your existing RBAC

I would not add `PropertyRole`, `TenantRole` or `ProviderRole` tables as competing authorization systems. Your existing `Role`, `Permission`, `OrganizationMember` and `OrganizationMemberRole` models remain the foundation.

Instead, define a consistent authorization flow:

1. Authenticate the user.
2. Resolve the active organization context.
3. Check the required permission.
4. Confirm the user's relevant resource relationship.
5. Check the agreement, assignment or tenancy is valid for the requested action.
6. Apply business rules such as approval limits and separation of duties.
7. Record sensitive actions in the audit log.

### Example authorization matrix

| Action                 | Required authorization context                                       |
| ---------------------- | -------------------------------------------------------------------- |
| Edit property details  | Portfolio permission and access to that property                     |
| View landlord reports  | Owner relationship or explicit reporting authorization               |
| Manage tenant lease    | Leasing permission and access to the relevant property or lease      |
| Approve expense        | Finance approval permission, expense access and valid approval state |
| View signed agreement  | Access to the corresponding lease and document                       |
| Update work order      | Maintenance permission and valid assignment to the job               |
| View provider schedule | Provider organization membership and applicable service assignment   |
| View tenant charges    | Verified tenant identity linked to the lease or charge               |

Your `ResourceRelationship` model can help with general access relationships, but it should not be the authoritative record of ownership or management contracts.

### RBAC issues to resolve

Organization-role consistency. Your current `OrganizationMemberRole` relation can connect a member of one organization to a role belonging to another organization unless the application prevents it. Validate the organization relationship when assigning roles. Consider stronger database enforcement where practical.

Global roles. Your `Role.organizationId` is nullable, and `@@unique([organizationId, slug])` does not guarantee uniqueness of global roles with null organization IDs in PostgreSQL. If global system roles must have globally unique slugs, enforce that explicitly, for example with a partial unique index or an appropriate schema redesign.

Active organization switching. Your `Session.organizationId` currently has no Prisma relation to `Organization`. Decide whether it represents a selected workspace, enforce that the user is an active member of that workspace, and consider adding a proper relation if it is intended to be a persistent foreign key.

Resource authorization. An active membership and a valid permission are not sufficient by themselves. A management company employee should only access properties covered by an active agreement and the employee's authorized responsibilities.

Audit history. Reuse `AuditLog` for sensitive domain operations, but ensure the application records meaningful before/after details for financial approvals, ownership changes, management agreements and access-sensitive actions. Avoid recording passwords, session tokens or unnecessary sensitive document contents.

## 6. Financial schema plan

Finance is the next major area where correctness matters more than convenience.

I would use the following relationships:

\#chatgpt-mermaid-\_r_ie\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_ie\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_ie\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_ie\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_ie\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ie\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_ie\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_ie\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_ie\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_ie\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_ie\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_ie\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ie\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ie\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_ie\_ p{margin:0;}#chatgpt-mermaid-\_r_ie\_ .entityBox{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_ie\_ .relationshipLabelBox{fill:rgb(48, 48, 48);opacity:0.7;background-color:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_ie\_ .relationshipLabelBox rect{opacity:0.5;}#chatgpt-mermaid-\_r_ie\_ .labelBkg{background-color:rgba(48, 48, 48, 0.5);}#chatgpt-mermaid-\_r_ie\_ .edgeLabel{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_ie\_ .edgeLabel .label rect{fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_ie\_ .edgeLabel .label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ie\_ .edgeLabel .label{fill:rgb(31, 78, 148);font-size:14px;}#chatgpt-mermaid-\_r_ie\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ie\_ .edge-pattern-dashed{stroke-dasharray:8,8;}#chatgpt-mermaid-\_r_ie\_ .node rect,#chatgpt-mermaid-\_r_ie\_ .node circle,#chatgpt-mermaid-\_r_ie\_ .node ellipse,#chatgpt-mermaid-\_r_ie\_ .node polygon{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_ie\_ .relationshipLine{stroke:rgb(175, 175, 175);stroke-width:1px;fill:none;}#chatgpt-mermaid-\_r_ie\_ .marker{fill:none!important;stroke:rgb(175, 175, 175)!important;stroke-width:1;}#chatgpt-mermaid-\_r_ie\_ [data-look=neo].labelBkg{background-color:rgba(48, 48, 48, 0.5);}#chatgpt-mermaid-\_r_ie\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_ie\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_ie\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_ie\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_ie\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ie\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_ie\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_ie\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_ie\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ie\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_ie\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_ie\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ie\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_ie\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_ie\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ie\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_ie\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ie\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}LEASERENT_CHARGEPAYMENT_ALLOCATIONPAYMENTPROPERTYEXPENSEEXPENSE_APPROVALFINANCIAL_ADJUSTMENTDEPOSIT_TRANSACTIONgeneratesreceivesallocatesincursrequirescorrected_byrecords

### Financial rules

- Use `Decimal` for money, not floating-point types.
- Store currency explicitly on financial records, even if KES is the initial default.
- Keep payment confirmation separate from payment initiation.
- Allow one payment to be allocated across multiple charges and one charge to receive multiple payments.
- Track deposits separately from rental income.
- Record approval, payment and reversal as separate business events.
- Preserve historical charges and adjustments rather than overwriting prior transactions.
- Make payment-provider callbacks idempotent so duplicate delivery cannot create duplicate payments.
- Ensure every transaction belongs to the correct portfolio and property where applicable.

For expense approvals, the `ExpenseApproval` record should preserve the approver, decision, timestamp, comments and relevant policy context. A single mutable `approvedBy` field on `Expense` is insufficient if an expense can be rejected, resubmitted or require several approval stages.

For owner reporting, calculate collection and arrears from charges and allocations, and calculate expense totals from authoritative expense/payment records according to clearly defined accounting rules. Do not treat a cash receipt as rental income automatically or assume that every approved expense has been paid.

## 7. Migration risks and safeguards

These are the issues I would prioritize before the first production migration.

| Risk                             | Why it matters                                                         | Recommended safeguard                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Incorrect ownership semantics    | The property workspace could be confused with its legal owner.         | Make ownership records explicit and define the canonical portfolio organization.                          |
| Cross-organization data exposure | Management-company users might see unrelated properties or leases.     | Test access through active management agreements and individual resource assignments.                     |
| Inconsistent role assignment     | Users could receive roles belonging to another organization.           | Validate membership-role organization consistency and test system-role assignment.                        |
| Inconsistent property references | A unit could reference a building from another property.               | Enforce cross-record consistency in the database or transactional application logic.                      |
| Destructive deletion             | Financial and legal history could disappear with a parent record.      | Use restrictive deletion, archival and documented retention rules.                                        |
| Incorrect rent history           | Historical rent could change when the unit's asking rent changes.      | Snapshot agreed lease terms and preserve historical charge records.                                       |
| Duplicate payments               | Webhook retries could create incorrect balances.                       | Use provider transaction identifiers, unique constraints and idempotent processing.                       |
| Invalid management access        | Expired or suspended contracts might still grant access.               | Check agreement status and effective dates on sensitive operations.                                       |
| Inaccessible documents           | Signed agreements might be exposed through public URLs.                | Use private storage and authorization-checked downloads.                                                  |
| Migration locking or downtime    | New indexes and constraints may affect existing data and availability. | Review table sizes, test migrations against a production-like copy, and use a staged rollout when needed. |

Before applying migrations, also verify the Prisma version and generator configuration in your actual project. Your schema uses `provider = "prisma-client"` with a custom output path, so the implementation should follow the installed Prisma version's generated-client and migration workflow rather than assuming a different setup.

## 8. Implementation sequence and acceptance criteria

I recommend building the second layer in five controlled increments.

Step 1 — Foundation integration

Validate organization-role consistency, session organization context, system roles, resource authorization and audit conventions.

Acceptance: existing authentication and RBAC tests pass, including cross-organization denial tests.

Step 2 — Property portfolio

Add properties, ownership, management agreements, buildings, units, unit types and staff assignments.

Acceptance: an individual landlord can create a portfolio, and a separate management company can access only properties covered by its valid agreements.

Step 3 — Tenancy and documents

Add tenants, leases, lease participants, units under lease, document versions and lifecycle events.

Acceptance: one tenant can have multiple leases, multiple unit types can exist in the same property, and signed agreements remain private and historically traceable.

Step 4 — Finance and operations

Add rent charges, payments, allocations, expenses, approval workflows, maintenance tickets and work orders.

Acceptance: partial payments, expense approvals and maintenance assignments work correctly without cross-portfolio data leakage.

Step 5 — Utilities, schedules and portals

Add service providers, recurring schedules, utility bills, service visits, and then tenant and provider workspaces.

Acceptance: service visits are independently tracked, provider access is scoped, and tenants can access all and only their authorized leases.

## 9. What I would not implement yet

I would defer advanced accounting, automated utility-meter integrations, a configurable workflow builder, sophisticated management-fee engines and multiple microservices.

I would also avoid creating generic abstractions for every possible future feature before the actual workflows are established. The ownership and management relationships need flexibility; every table does not.

The priority is a small set of well-designed relational models, enforceable authorization, trustworthy financial records and private document storage.

## 10. The next implementation deliverable

The next useful artifact is a complete, validated second-layer Prisma schema that incorporates the existing foundation rather than replacing it.

Before generating it, I would verify these two remaining details against your actual codebase:

- The current Prisma version and whether any domain models already exist outside the schema you shared.
- Whether you already have a file-storage abstraction, payment records, notification infrastructure or domain-specific authorization helpers that the second layer must reuse.

If the schema you provided is the complete current database foundation, we can proceed from it. The target is to produce:

1. A consolidated Prisma schema with all required inverse relations, enums, indexes and deletion policies.
2. A model-by-model explanation of the domain boundaries.
3. A migration plan with data-integrity checks and rollback considerations.
4. RBAC integration requirements and cross-organization security tests.
5. A phased implementation checklist for your coding agent.

My strongest recommendation: establish the ownership and management agreement model first, then build properties, units and leases on top of it. If those relationships are correct, tenant portals, service-provider access, caretaker assignments and landlord reporting can all grow from the same foundation without duplicating the core property records.
