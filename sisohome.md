# SisoHome — Property Management Architecture Blueprint

New architecture proposal · Landlords · Property managers · Tenants · Maintenance providers · Utility companies

I would rebuild the architecture around SisoHome as a property operations platform, not just a landlord dashboard. The system needs to coordinate the entire property lifecycle: ownership, units, tenancy agreements, rent, expenses, utilities, maintenance, service schedules and reporting.

I would also treat your existing RBAC as an established component. We should design the domain model and workflows to use it, rather than replace it or introduce a competing permission system.

The central design principle is:

> One property can contain many different unit types, one tenant can lease multiple units across multiple properties, and multiple organizations can be responsible for managing or servicing those properties — without duplicating the underlying records.

This architecture is a proposed target, not a replacement for your existing schema yet. Once you share your starting schema and current implementation, we can reconcile the two and identify what should be retained, extended or changed.

## 1. The SisoHome operating model

## SisoHome

Shared property, tenancy, finance, document and service records

Landlord

Owns assets, reviews reports and authorizes decisions assigned to them.

Property management company

Manages multiple properties and owners, staff, tenants and operations.

Tenant

Has their own tenancy agreements, leased units, charges and service requests.

Service provider

Handles assigned maintenance, recurring services and scheduled visits.

Management dashboard

Mobile workspace

WhatsApp

SisoHome should support two customer operating models from the same foundation:

- Self-managed landlord: the owner manages their own property, finances and service providers.
- Managed portfolio: a property management company operates properties for multiple landlords, with separate staff responsibilities and owner-specific reporting.

Later, tenant and service-provider portals become additional workspaces on the same underlying system. They should not become disconnected applications with their own versions of properties, units or maintenance records.

## 2. Core domain model

The most important architectural decision is to separate the physical property, rentable units, tenancy agreements, financial obligations and external service providers.

### A. Property and unit structure

The hierarchy should be:

\#chatgpt-mermaid-\_r_t4\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_t4\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_t4\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_t4\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_t4\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_t4\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_t4\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_t4\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_t4\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_t4\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_t4\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_t4\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_t4\_ p{margin:0;}#chatgpt-mermaid-\_r_t4\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_t4\_ .label text,#chatgpt-mermaid-\_r_t4\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ .node rect,#chatgpt-mermaid-\_r_t4\_ .node circle,#chatgpt-mermaid-\_r_t4\_ .node ellipse,#chatgpt-mermaid-\_r_t4\_ .node polygon,#chatgpt-mermaid-\_r_t4\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .rough-node .label text,#chatgpt-mermaid-\_r_t4\_ .node .label text,#chatgpt-mermaid-\_r_t4\_ .image-shape .label,#chatgpt-mermaid-\_r_t4\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_t4\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .rough-node .label,#chatgpt-mermaid-\_r_t4\_ .node .label,#chatgpt-mermaid-\_r_t4\_ .image-shape .label,#chatgpt-mermaid-\_r_t4\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_t4\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_t4\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_t4\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_t4\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_t4\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_t4\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_t4\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_t4\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_t4\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_t4\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_t4\_ .icon-shape,#chatgpt-mermaid-\_r_t4\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_t4\_ .icon-shape p,#chatgpt-mermaid-\_r_t4\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_t4\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_t4\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_t4\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_t4\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_t4\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_t4\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_t4\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_t4\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_t4\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_t4\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_t4\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_t4\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_t4\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_t4\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_t4\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .node rect,#chatgpt-mermaid-\_r_t4\_ .node circle,#chatgpt-mermaid-\_r_t4\_ .node ellipse,#chatgpt-mermaid-\_r_t4\_ .node polygon,#chatgpt-mermaid-\_r_t4\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_t4\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_t4\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_t4\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_t4\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Landlord / OwnerOwnership relationshipProperty / EstateManagement companyManagement agreementBuildings - optionalUnits - directUnits - within buildingsUnit type and rent termsUnit type and rent terms

Proposed entities

| Entity                | Responsibility                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Property`            | The managed site or asset, including its name, address, status and ownership/management relationships.       |
| `Building`            | An optional physical structure inside a property or estate.                                                  |
| `Unit`                | The individual rentable space, such as an apartment, bedsitter, shop, office, house or parking space.        |
| `UnitType`            | A reusable classification such as bedsitter, one-bedroom, two-bedroom, shop or office.                       |
| `PropertyOwnership`   | Connects an owner to a property, including ownership share or effective dates where applicable.              |
| `ManagementAgreement` | Connects a property owner and management organization, including the management period and applicable terms. |
| `StaffAssignment`     | Assigns a manager, caretaker or other staff member to the relevant property or building.                     |

A property can have mixed unit types. For example, one estate might have 30 bedsitters, 20 one-bedroom apartments, 10 two-bedroom apartments and 4 shops.

Do not make the number of units, type of unit or rent amount fixed on the property record. Those belong at the appropriate unit or agreement level.

### B. Rent must be flexible

A unit's advertised or expected rent is not necessarily the rent a tenant is contractually required to pay.

For example, two similar one-bedroom apartments might rent for KES 12,000 and KES 14,000 because of floor level, furnishing, condition or a negotiated agreement.

I recommend distinguishing:

- Unit type: what kind of unit it is.
- Market or asking rent: an optional indicative amount.
- Lease rent: the actual agreed amount for a particular tenancy.
- Recurring charges: other amounts due, such as water, service charges or parking, when applicable.
- Deposit terms: the deposit required under the agreement and the amount actually received.

This avoids the mistake of making a unit's rent amount the single source of truth for every tenant who occupies it over time.

## 3. Tenants, leases and agreement documents

A tenant must be able to have multiple active leases, including leases across different properties. A lease must also be able to cover multiple tenants or units where the agreement requires it.

The model should not force a one-tenant-to-one-property relationship.

\#chatgpt-mermaid-\_r_td\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_td\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_td\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_td\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_td\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_td\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_td\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_td\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_td\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_td\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_td\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_td\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_td\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_td\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_td\_ p{margin:0;}#chatgpt-mermaid-\_r_td\_ .entityBox{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_td\_ .relationshipLabelBox{fill:rgb(48, 48, 48);opacity:0.7;background-color:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_td\_ .relationshipLabelBox rect{opacity:0.5;}#chatgpt-mermaid-\_r_td\_ .labelBkg{background-color:rgba(48, 48, 48, 0.5);}#chatgpt-mermaid-\_r_td\_ .edgeLabel{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_td\_ .edgeLabel .label rect{fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_td\_ .edgeLabel .label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_td\_ .edgeLabel .label{fill:rgb(31, 78, 148);font-size:14px;}#chatgpt-mermaid-\_r_td\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_td\_ .edge-pattern-dashed{stroke-dasharray:8,8;}#chatgpt-mermaid-\_r_td\_ .node rect,#chatgpt-mermaid-\_r_td\_ .node circle,#chatgpt-mermaid-\_r_td\_ .node ellipse,#chatgpt-mermaid-\_r_td\_ .node polygon{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_td\_ .relationshipLine{stroke:rgb(175, 175, 175);stroke-width:1px;fill:none;}#chatgpt-mermaid-\_r_td\_ .marker{fill:none!important;stroke:rgb(175, 175, 175)!important;stroke-width:1;}#chatgpt-mermaid-\_r_td\_ [data-look=neo].labelBkg{background-color:rgba(48, 48, 48, 0.5);}#chatgpt-mermaid-\_r_td\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_td\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_td\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_td\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_td\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_td\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_td\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_td\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_td\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_td\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_td\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_td\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_td\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_td\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_td\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_td\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_td\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_td\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}TENANTLEASE_TENANTLEASELEASE_UNITUNITLEASE_DOCUMENTLEASE_CHARGELEASE_EVENTDOCUMENT_VERSIONparticipates_inincludescoversleased_underhasgeneratesrecordscontains

Here, `LeaseTenant` and `LeaseUnit` are relationship entities. They make the model flexible without requiring duplicate lease records just because an agreement has multiple tenants or units.

If your actual business rules require exactly one tenant and one unit per lease, these relationships can still support that initial case without blocking future expansion.

### Agreement document management

SisoHome must save a copy of the tenancy agreement, not merely store the agreement dates and rent amount.

Each lease should support:

- The signed agreement file and any supporting documents.
- The date signed, start date, end date and applicable renewal terms.
- The landlord, tenant or tenants, and leased unit or units.
- The agreed rent, deposit, payment frequency and relevant charges.
- Document version history, where amended agreements are issued.
- Upload time, uploader, verification status and relevant audit history.
- Renewal, termination, handover and other important lifecycle events.

Use private object storage for the actual files. Store file metadata, storage keys, access permissions, document hashes where useful, and version references in the database. Downloads must require authorization.

A signed agreement should not be silently overwritten when a renewal occurs. Preserve the original, then attach the new signed version or the new agreement as appropriate.

Important distinction: a scanned or uploaded signed agreement is evidence of the agreement. It is not automatically a digitally executed agreement. E-signatures, legal validation and formal electronic signing workflows can be considered separately.

### Tenant portal readiness

Even if the portal comes later, establish the relationship between `User` and `Tenant` from the start.

A tenant record is the business identity; a user account is the login identity. A tenant may have a record before being invited to the portal. Once invited and verified, the user can access all authorized leases and properties associated with that tenant identity.

That means a tenant with two leases across different buildings can view both without having two unrelated portal accounts.

Avoid using the tenant's phone number as the tenant's primary database identity. Phone numbers and email addresses can change, and some leases involve multiple occupants.

## 4. Key roles for property management

Since RBAC already exists in your implementation, this section defines the business roles and their responsibilities rather than proposing a new authorization system.

The critical distinction is that finance controls financial processing, the manager controls operations, and the landlord retains the rights assigned to them by ownership and management arrangements.

| Role                               | Main responsibilities                                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landlord / owner                   | View owned-property reports, review expenses, monitor rent, and approve decisions assigned to the owner.                                            |
| Property manager                   | Manage assigned properties, tenants, leases, maintenance, vacancies, inspections and operational tasks.                                             |
| Finance officer / accountant       | Record and reconcile payments, maintain rent ledgers, review expenses, prepare statements and execute authorized financial actions.                 |
| Finance approver                   | Approve expenses and financial adjustments within assigned limits and scope. This may be a separate role or a permission held by a finance manager. |
| Caretaker / site supervisor        | Inspect units, report issues, update assigned jobs, upload evidence and manage on-site schedules.                                                   |
| Leasing / tenancy officer          | Handle tenant onboarding, lease preparation, agreement documents, renewals, move-ins and move-outs.                                                 |
| Maintenance coordinator            | Assign technicians, schedule jobs, track service-level deadlines and verify completion.                                                             |
| Tenant                             | Access their own lease information, agreements, charges, receipts and maintenance requests.                                                         |
| Maintenance company administrator  | Manage its technicians, assigned jobs, service schedules and work completion records.                                                               |
| Maintenance technician             | Access assigned work orders, inspection instructions, schedules and completion evidence.                                                            |
| Utility / service provider contact | Receive service schedules and submit collection or service completion confirmations where authorized.                                               |

A person can hold more than one role when the organization is small. For example, an individual landlord might also act as the property manager and expense approver.

However, where a company needs separation of duties, the system should support it. A person submitting an expense should not automatically be allowed to approve it simply because they have access to the finance module.

### Expense approval workflow

I recommend a configurable approval policy with sensible defaults:

1. A staff member submits an expense with the property, category, amount, supplier, description and supporting evidence.
2. The manager reviews whether the expense is necessary and associated with the correct property.
3. Finance verifies the amount, documentation, budget or accounting treatment.
4. The appropriate authorized approver approves or rejects the expense.
5. Finance records or confirms payment.
6. The transaction appears in the property ledger and the landlord's authorized reporting view.

Not every expense needs every approval stage. The organization should configure the applicable thresholds and approval rules. Small, routine expenses may use a simpler process; larger expenses may require both management and owner approval.

Approval, recording an expense, and paying an expense are three different actions and should not be collapsed into a single status.

## 5. Finance and landlord real-time reporting

The finance model must be designed before the dashboard metrics. Otherwise, the interface may look convincing while displaying incorrect balances.

### Core finance entities

| Entity                                     | Purpose                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `LeaseCharge`                              | Amount due under a lease, including rent and applicable recurring charges.          |
| `Payment`                                  | A payment received through M-Pesa, bank transfer, cash or another supported method. |
| `PaymentAllocation`                        | The portion of a payment applied to a specific charge or outstanding balance.       |
| `DepositAccount` or deposit ledger entries | Tracks tenant deposits separately from rent income.                                 |
| `Expense`                                  | An expense associated with a property, work order or other relevant activity.       |
| `ExpenseApproval`                          | Records approval decisions, approvers, amounts and timestamps.                      |
| `FinancialAdjustment`                      | Records authorized corrections and reversals.                                       |
| `Receipt`                                  | The record or document issued for a confirmed payment.                              |
| `OwnerStatement`                           | A reporting-period statement generated from the underlying transactions.            |

The exact schema can be simplified depending on what your current implementation already supports. The business rules should remain intact.

### What the landlord should see

## Owner financial workspace

Illustrative dashboard layout; amounts shown below are examples, not actual account data.

Rent due

# KES 450,000

Collected

# KES 382,000

Outstanding

# KES 68,000

Pending expense approvals

# 3

Additional reporting

- Rent collection by property and month.
- Tenant arrears and aging.
- Occupancy, vacant units and upcoming lease expirations.
- Approved expenses and maintenance expenditure.
- Net operating income, using clearly documented definitions.
- Management fees and owner distributions where applicable.
- Downloadable statements and transaction-level drill-down.

The values above are illustrative. In production, each metric must be calculated from authoritative records for the selected properties and reporting period.

### What “real-time” should mean

A landlord should see a confirmed payment reflected shortly after the transaction is processed, rather than waiting for a monthly report.

To achieve that:

- Update financial records transactionally.
- Refresh affected dashboard queries after relevant events.
- Recalculate outstanding balances from the ledger or use carefully maintained projections.
- Keep projections and cached summaries reconcilable to the underlying records.
- Distinguish confirmed, pending, failed and reversed payments.
- Show the reporting period, last updated time and any data that is still pending reconciliation.

The system should never confuse rent charged, money received, rent allocated, outstanding arrears, and money available for distribution to an owner. These are different financial concepts.

For the initial release, a transactional ledger and reliable reports are more important than building a sophisticated accounting engine.

## 6. Utilities, utility companies and collection schedules

This deserves its own domain module. Utility companies and recurring service providers are not just entries in a maintenance list.

SisoHome should support providers such as:

- Garbage collection companies.
- Water suppliers and utility providers.
- Electricity providers, where property-level records are needed.
- Internet and security service providers.
- Cleaning and sanitation companies.
- Pest control providers.
- Landscaping and groundskeeping companies.

Not all of these operate the same way. Some bill a property monthly, some charge per visit, and others follow a recurring collection schedule. The architecture should support those differences without creating a different database table for every provider type.

### Recommended entities

| Entity                      | Responsibility                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `ServiceProvider`           | The company or individual providing the service, including contact details and provider category. |
| `ServiceAgreement`          | The agreement between the property owner or manager and the provider.                             |
| `PropertyServiceAssignment` | Connects a service agreement or provider to one or more properties.                               |
| `ServiceSchedule`           | Defines recurrence, planned dates, frequency, service window and assigned property.               |
| `ServiceVisit`              | Represents an actual or planned occurrence of a service.                                          |
| `ServiceCompletion`         | Records that the visit occurred, who confirmed it and supporting evidence.                        |
| `UtilityBill`               | A bill issued by a utility provider or service company.                                           |
| `UtilityChargeAllocation`   | Allocates a bill or charge to a property, unit, tenant or another agreed cost center.             |
| `ProviderInvoice`           | Records the amount invoiced for contracted services or completed work.                            |

You can reuse a common `ServiceProvider` identity for both utilities and maintenance companies, with provider categories and service-specific agreements. Avoid creating duplicate provider records because one company performs both garbage collection and plumbing work.

### Example: garbage collection

Imagine a property has a garbage collection company that visits every Tuesday and Friday.

The system should let the manager:

1. Register the provider and its service agreement.
2. Assign the service to the relevant property or properties.
3. Define the recurring collection schedule.
4. Generate scheduled service visits.
5. Notify the caretaker and provider of upcoming visits.
6. Record completion, missed collections or exceptions.
7. Attach evidence, notes and any applicable invoice.
8. Report service performance and related expenses.

A planned collection is not proof that collection occurred. Keep scheduled visits separate from confirmed service completions.

### Utility billing and tenant charges

Utility billing needs additional care. A provider's bill may be for an entire property, a shared meter, an individual unit, or a particular tenant's consumption.

SisoHome should distinguish:

- The original utility bill and its issuer.
- The property or unit to which the cost relates.
- Meter readings and consumption, if applicable.
- The allocation method, such as a dedicated meter, recorded consumption, agreed fixed charge or another authorized rule.
- The portion charged to a tenant, if the lease and applicable rules permit it.
- The amount paid to the utility provider and any outstanding balance.

Do not assume every utility bill can be divided equally among units or passed on to tenants. Allocation rules must be explicit, traceable and consistent with the applicable agreement.

For the MVP, begin with bill recording and straightforward allocations. Automated meter ingestion, complex shared-meter calculations and utility-provider APIs can come later.

## 7. Maintenance companies and technician portals

SisoHome should treat maintenance companies as external organizations with their own staff and schedules.

A maintenance company may serve multiple property management companies and landlords. One technician may work across multiple sites, while another may only be authorized for particular jobs or locations.

### Suggested model

\#chatgpt-mermaid-\_r_up\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_up\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_up\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_up\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_up\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_up\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_up\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_up\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_up\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_up\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_up\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_up\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_up\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_up\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_up\_ p{margin:0;}#chatgpt-mermaid-\_r_up\_ .entityBox{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_up\_ .relationshipLabelBox{fill:rgb(48, 48, 48);opacity:0.7;background-color:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_up\_ .relationshipLabelBox rect{opacity:0.5;}#chatgpt-mermaid-\_r_up\_ .labelBkg{background-color:rgba(48, 48, 48, 0.5);}#chatgpt-mermaid-\_r_up\_ .edgeLabel{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_up\_ .edgeLabel .label rect{fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_up\_ .edgeLabel .label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_up\_ .edgeLabel .label{fill:rgb(31, 78, 148);font-size:14px;}#chatgpt-mermaid-\_r_up\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_up\_ .edge-pattern-dashed{stroke-dasharray:8,8;}#chatgpt-mermaid-\_r_up\_ .node rect,#chatgpt-mermaid-\_r_up\_ .node circle,#chatgpt-mermaid-\_r_up\_ .node ellipse,#chatgpt-mermaid-\_r_up\_ .node polygon{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_up\_ .relationshipLine{stroke:rgb(175, 175, 175);stroke-width:1px;fill:none;}#chatgpt-mermaid-\_r_up\_ .marker{fill:none!important;stroke:rgb(175, 175, 175)!important;stroke-width:1;}#chatgpt-mermaid-\_r_up\_ [data-look=neo].labelBkg{background-color:rgba(48, 48, 48, 0.5);}#chatgpt-mermaid-\_r_up\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_up\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_up\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_up\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_up\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_up\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_up\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_up\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_up\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_up\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_up\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_up\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_up\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_up\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_up\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_up\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_up\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_up\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}SERVICE_PROVIDERSERVICE_AGREEMENTPROPERTY_SERVICE_ASSIGNMENTPROPERTYPROVIDER_STAFFWORK_ORDER_ASSIGNMENTWORK_ORDERWORK_ORDER_VISITWORK_COMPLETIONsignscoversreceivesemploysreceiveshasschedulesrecords

Suggested entities include:

- `ServiceProvider`: the maintenance company or independent contractor.
- `ProviderStaff`: the provider's employees or technicians, linked to their user accounts where applicable.
- `WorkOrder`: the authorized repair or maintenance job.
- `WorkOrderAssignment`: which technician or team is responsible.
- `WorkOrderVisit`: a scheduled site visit, including date, time window and status.
- `WorkCompletion`: the completion record, notes, photos, materials and actual work performed.
- `ServiceAgreement`: applicable scope, rates, coverage and terms.

The `WorkOrder` should be linked to the original maintenance ticket where one exists. Planned preventive maintenance may create work orders without a tenant complaint.

### Maintenance company portal

The provider administrator should be able to:

- See work orders assigned to their company.
- Assign eligible technicians.
- Manage technician availability and service calendars.
- Accept or reject jobs where the agreement permits.
- Schedule visits and communicate expected arrival windows.
- Submit estimates or quotations where required.
- Record work performed and attach photos.
- Submit invoices and mark work as completed.
- Track outstanding approvals and payment status where authorized.

Technicians should only see the jobs, property access details and tenant contact information necessary for their assignments.

### Scheduling and recurring maintenance

Use a reusable scheduling model for both external service visits and internal maintenance.

For example, the system should support:

- Garbage collection every Tuesday and Friday.
- Water tank inspections every three months.
- Lift servicing under a maintenance contract.
- Fire safety inspections on scheduled dates.
- Routine plumbing inspections.
- One-off emergency repairs.

A recurring schedule should generate individual scheduled occurrences, not a single task that remains open indefinitely. Each occurrence needs its own status, assigned person, due date, completion record and exception handling.

## 8. Navigation architecture

The existing PrimeStay design can evolve into SisoHome with a consistent visual language and role-specific menus.

For the landlord and property manager workspace, I would use:

Overview

Properties & Units

Owners & Tenants

Leases & Agreements

Rent & Finance

Maintenance & Work Orders

Utilities & Service Schedules

Staff & Service Providers

Reports & Statements

Settings & Integrations

Keep service agreements, schedules, invoices and completed visits available from the relevant property workspace as well. Global navigation should provide cross-portfolio visibility for users who need it.

Separate portals can use simpler navigation:

- Tenant portal: My Properties / Leases, Payments & Receipts, Documents, Maintenance Requests and Announcements.
- Caretaker workspace: My Tasks, Inspections, Service Visits, Report an Issue and My Properties.
- Maintenance provider portal: Work Orders, Schedule, Technicians, Estimates, Completion Reports and Invoices.
- Utility provider access: service schedules, collection confirmations, invoices and service history, limited to the contracted work.

These portals can share components and backend modules while using different entry points and authorization scopes.

## 9. Application architecture

I recommend a modular monolith for the first release, using your existing stack and RBAC implementation wherever they already meet these requirements.

Do not start by splitting tenants, finance, maintenance and utilities into separate microservices. These modules share property relationships, permissions and transactions; a modular monolith will make the initial system easier to reason about and maintain.

\#chatgpt-mermaid-\_r_vd\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_vd\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_vd\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_vd\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_vd\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vd\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_vd\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_vd\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_vd\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_vd\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_vd\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_vd\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_vd\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_vd\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_vd\_ p{margin:0;}#chatgpt-mermaid-\_r_vd\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vd\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vd\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vd\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_vd\_ .label text,#chatgpt-mermaid-\_r_vd\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vd\_ .node rect,#chatgpt-mermaid-\_r_vd\_ .node circle,#chatgpt-mermaid-\_r_vd\_ .node ellipse,#chatgpt-mermaid-\_r_vd\_ .node polygon,#chatgpt-mermaid-\_r_vd\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_vd\_ .rough-node .label text,#chatgpt-mermaid-\_r_vd\_ .node .label text,#chatgpt-mermaid-\_r_vd\_ .image-shape .label,#chatgpt-mermaid-\_r_vd\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_vd\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_vd\_ .rough-node .label,#chatgpt-mermaid-\_r_vd\_ .node .label,#chatgpt-mermaid-\_r_vd\_ .image-shape .label,#chatgpt-mermaid-\_r_vd\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_vd\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_vd\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_vd\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_vd\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_vd\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_vd\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_vd\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_vd\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_vd\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_vd\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_vd\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vd\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vd\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_vd\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_vd\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_vd\_ .icon-shape,#chatgpt-mermaid-\_r_vd\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_vd\_ .icon-shape p,#chatgpt-mermaid-\_r_vd\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_vd\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_vd\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_vd\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_vd\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_vd\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_vd\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_vd\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_vd\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_vd\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_vd\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_vd\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_vd\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_vd\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_vd\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_vd\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_vd\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_vd\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_vd\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_vd\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_vd\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_vd\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_vd\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_vd\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_vd\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_vd\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_vd\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_vd\_ .node rect,#chatgpt-mermaid-\_r_vd\_ .node circle,#chatgpt-mermaid-\_r_vd\_ .node ellipse,#chatgpt-mermaid-\_r_vd\_ .node polygon,#chatgpt-mermaid-\_r_vd\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_vd\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_vd\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_vd\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_vd\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_vd\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Landlord and manager portalTenant portalCaretaker workspaceService provider portalWhatsApp integrationApplication APIIntegration handlersExisting RBAC and accesschecksDomain modulesProperties and unitsTenancy and documentsRent and financeMaintenance and work ordersUtilities and service schedulesReportingRelational databasePrivate document storageBackground jobs and eventsNotifications and scheduledreportsPayment and messagingproviders

### Module boundaries

| Module                 | Owns                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ |
| Identity and access    | Existing RBAC integration, organization memberships and resource authorization |
| Portfolio              | Owners, properties, buildings, units and management relationships              |
| Tenancy                | Tenant profiles, leases, lease participants, agreement documents and occupancy |
| Finance                | Charges, payments, allocations, deposits, expenses and approvals               |
| Maintenance            | Tickets, work orders, technician assignments and completion records            |
| Utilities and services | Providers, service agreements, bills, schedules and visits                     |
| Documents              | File metadata, document versions, access policies and retention                |
| Notifications          | WhatsApp messages, reminders, delivery status and retries                      |
| Reporting              | Owner statements, operational dashboards and reconciled financial summaries    |

These are logical module boundaries. They do not necessarily require separate deployment units or separate databases.

## 10. Phased implementation plan

I would sequence the work as follows.

## 01

Foundation

Properties, ownership and tenancy

- Integrate existing RBAC.
- Establish ownership and management relationships.
- Implement properties, optional buildings, mixed unit types and unit records.
- Support multiple tenants, units and leases through explicit relationships.
- Store private tenancy agreement copies and document versions.
- Implement staff assignments and basic property dashboards.

## 02

Operations

Rent, expenses and maintenance

- Rent charges, payment allocation, arrears and receipts.
- Expense submissions, approvals and payment status.
- Maintenance tickets and work orders.
- Caretaker assignments, inspections and evidence.
- Landlord financial reporting with transaction drill-down.

## 03

Services

Utilities and external providers

- Utility bills and traceable allocations.
- Service-provider records and agreements.
- Recurring collection schedules and service visits.
- Maintenance company and technician assignments.
- Provider invoices and completion reports.

## 04

Self-service

Portals and automation

- Tenant portal across multiple leases.
- Caretaker mobile workspace and WhatsApp quick actions.
- Maintenance provider portal and scheduling.
- M-Pesa integration and automated reconciliation.
- Scheduled reminders, statements and service notifications.

This order can be adjusted after reviewing your current implementation. If your existing schema already handles some of these areas, we should reuse working parts rather than rebuild them just to match a new diagram.

## 11. What we must validate before finalizing the schema

These are the key architectural decisions I would explicitly check against your existing code:

- Can one property have multiple owners and a management company?
- Can a property contain units directly or through optional buildings?
- Can units have different types and different rent amounts?
- Can one lease cover multiple tenants or units, and can one tenant have multiple active leases?
- Can signed tenancy agreements and amended versions be stored privately?
- Can expenses be submitted, approved, paid and audited as distinct events?
- Can utility providers and maintenance companies serve multiple properties and customers?
- Can a service schedule generate multiple independent visits?
- Can landlords see updated financial reports without receiving access to other owners' records?
- Can the tenant and service-provider portals be added without duplicating the core domain data?
- Can the current RBAC authorize actions based on the specific property, organization, assignment and financial operation?

Any answer that requires duplicating a property or tenant record to make the workflow work is a warning sign.

## 12. Next step: review your starting schema

Please share your existing Prisma schema or the relevant database models, together with any existing RBAC models or relationships that affect property access. If you use another ORM or database, share the equivalent schema.

I will use that as the source of truth and produce a grounded architecture review with:

1. Keep — models and relationships that are already correct.
2. Extend — existing models that need additional fields or relationships.
3. Add — genuinely missing entities for tenancy documents, utilities, service schedules, maintenance providers and financial approvals.
4. Change — relationships or constraints that would block the required workflows.
5. Defer — models that are unnecessary for the initial release.
6. Migration risks — changes that could break existing data, RBAC or application workflows.

I will not assume your current schema is wrong, prescribe a replacement before inspecting it, or invent fields and implementation details that your code does not support.

The goal is to arrive at a SisoHome target architecture that fits your existing implementation, supports the required workflows and can evolve into tenant and provider portals without a costly redesign.
