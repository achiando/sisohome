# SisoHome: Refined property-domain design

The decisions establish the direction for the property operations layer. The next step is to define the workflow and relationships so rent, utilities, occupancy, payments, and property contacts operate as one connected system.

The central principle is: the property describes the physical asset, the unit describes the rentable space, the lease defines the tenancy and financial terms, and the ledger records what is owed and what has been paid.

Ownership, organization membership, authentication, and permissions remain outside this design.

## 1. The core domain relationship

Property

Identity, location, property type and status

Buildings (optional) → Units

Physical layout, availability and unit-specific defaults

Lease

One or more units, one or more tenants, dates, rent terms and deposit terms

Charge schedule

Rent and recurring charges

Utility billing

Readings, bills and allocations

Financial ledger

Charges, payments, allocations, adjustments and outstanding balances

Other relationships—agents, house hunters, staff, service providers, maintenance requests and documents—connect to the relevant property, unit, lease or work order. They should not be forced into the rent-management chain.

## 2. Refine the property and unit models

### `Property`

The property record should contain stable information about the asset:

- Name and property reference
- Property category and description
- Address, coordinates and locality
- Images, amenities and relevant attributes
- Operational status, such as draft, active, inactive or archived
- Configurable property-level defaults
- Creation and update timestamps

Do not store current rent balances, utility balances or tenant-specific rent terms directly on the property. Those belong to financial and tenancy records.

### `Building` and `Unit`

A building is optional. Units can belong directly to a property or to a building within it.

A unit should include:

- Unit number or unique reference within its property
- Unit type, floor and relevant physical attributes
- Occupancy/availability status
- Default rent amount, currency and suggested billing frequency
- Optional deposit default and default recurring charges
- Meter associations where relevant

Unit defaults are templates, not financial obligations. Changing a unit's default rent should not silently change an existing lease or previously generated charges.

For multi-unit leases, use a `LeaseUnit` relationship with unit-specific lease terms where necessary. That avoids assuming every unit covered by one lease has the same rent.

## 3. Lease lifecycle and occupancy

The lease should be the source of truth for the contractual tenancy.

### Recommended lease workflow

1

Draft

Enter parties, units, dates, rent and deposit terms.

2

Pending approval / signature

Review and complete the required documentation.

3

Scheduled

Approved lease awaiting its start date.

4

Active

Tenancy is in effect and charges can be generated.

5

Ending / notice

Record notice, expected end date and move-out actions.

6

Closed

Finalize the tenancy, reconcile the account and release the units.

The states should not be treated as a simple irreversible sequence. A lease might be cancelled before it starts, terminated early, or renewed through a new lease or an explicitly modelled renewal process.

Important rules:

- An active lease must have valid dates, at least one unit and at least one tenant.
- The system must prevent unintended overlapping active leases for the same unit.
- Joint tenants must be supported without duplicating the lease itself.
- A lease can cover multiple units, with rent assigned per unit or as an agreed combined amount.
- Lease amendments must preserve the history of contractual changes.
- Closing a lease must not erase unpaid balances or payment history.
- Unit occupancy should be consistent with lease dates and operational availability; it should not depend only on a manually selected status.

### Suggested lease models

| Model             | Purpose                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `Lease`           | Lease reference, dates, lifecycle status, currency and general terms           |
| `LeaseTenant`     | Tenants associated with the lease, including their relationship to the tenancy |
| `LeaseUnit`       | Units covered and unit-specific rent terms                                     |
| `LeaseChargeRule` | Recurring rent and other scheduled charges                                     |
| `LeaseDocument`   | Lease documents and related records                                            |
| `DocumentVersion` | Version history where required                                                 |

A lease charge rule describes what should be charged and when. It should not itself represent an amount already billed.

## 4. Rent and financial ledger

I recommend a small, reusable financial subsystem instead of building separate rent, utility and payment balances.

### Core models

| Model                 | Responsibility                                                        |
| --------------------- | --------------------------------------------------------------------- |
| `Charge`              | An amount owed, its type, source, due date and billing period         |
| `Payment`             | A received payment, reference, amount, date and reconciliation status |
| `PaymentAllocation`   | The amount of a payment applied to a particular charge                |
| `FinancialAdjustment` | Credits, waivers, corrections and reversals                           |
| `Receipt`             | Evidence issued for a recorded payment or applicable allocation       |
| `ChargeSchedule`      | Rules for generating recurring charges                                |

The earlier `RentCharge` concept can be retained as a name if preferred, but a generic `Charge` model is more reusable because rent, utilities, garbage collection and other tenant charges share the same collection process.

Each charge should retain its source, such as a lease rule or utility allocation. That makes it possible to trace a tenant's balance back to the original reason for the charge.

### Example: monthly rent collection

Suppose a lease requires KES 18,000 rent per month and the tenant pays KES 10,000 initially.

| Ledger event              | Amount     |
| ------------------------- | ---------- |
| Rent charge posted        | KES 18,000 |
| Payment recorded          | KES 10,000 |
| Payment allocated to rent | KES 10,000 |
| Remaining rent balance    | KES 8,000  |

The remaining balance is derived from the charge less valid allocations and applicable adjustments. The system should not overwrite the original KES 18,000 charge to show the partial payment.

### Collection workflow

1. Generate charges according to the lease schedule.
2. Review and post the charges.
3. Record payments manually in the first version.
4. Allocate payments to one or more charges.
5. Issue a receipt and update the account view.
6. Identify overdue charges and follow-up actions.
7. Reconcile the property, unit and tenant collection reports.

A payment should support partial allocations, multiple allocations and temporarily unallocated amounts. Payment-provider integrations can later create payment records through the same workflow rather than introducing a separate financial system.

Accounting boundary: this ledger can manage tenant receivables and collection reconciliation. If SisoHome also needs full bookkeeping, bank reconciliation, income statements and balance sheets, that should be designed as a separate accounting layer connected to these records.

## 5. Utility billing and collection

Utilities should have their own operational records but produce charges that use the same ledger.

### Utility models

| Model                     | Responsibility                                                       |
| ------------------------- | -------------------------------------------------------------------- |
| `UtilityConfiguration`    | Utility type, billing method, rate rules and applicable scope        |
| `UtilityMeter`            | Meter identity, location, unit association and meter details         |
| `MeterReading`            | Reading value, reading date, source and validation status            |
| `UtilityBill`             | Supplier bill, total amount, billing period and source document      |
| `UtilityBillLine`         | Optional breakdown of the supplier bill                              |
| `UtilityChargeAllocation` | Amount assigned to a unit, lease or tenant, with calculation details |

A utility configuration should support three billing methods.

1\. Metered

For a meter reading of 125 units followed by 143 units, consumption is 18 units. The charge is calculated using the configured tariff, including any applicable fixed fees or tiered rates.

2\. Fixed

Generate a configured amount for each applicable unit or lease on the selected billing schedule.

3\. Shared cost

Take a supplier bill and allocate it across the relevant units or tenants according to a defined method, such as equal shares, unit size, occupancy or measured consumption.

The allocation method and its inputs must be retained so that charges can be explained and audited later.

### Utility workflow

1. Configure the utility and billing method.
2. Capture meter readings or the supplier bill.
3. Calculate consumption or the shared cost allocation.
4. Validate the calculations against the source data.
5. Review and post the resulting tenant charges.
6. Collect payments through the common payment workflow.
7. Reconcile the supplier bill against allocated amounts and report any difference.

Do not assume that the sum allocated to tenants must always equal the supplier bill. The landlord may cover common-area consumption, absorb a portion of the cost or apply another contractual arrangement. Any unallocated portion should remain visible and explainable.

## 6. Other property relationships

The property must support many related parties, but each relationship should have its own purpose and lifecycle.

| Relationship or model     | Link to                                  | Key use                               |
| ------------------------- | ---------------------------------------- | ------------------------------------- |
| `PropertyInterest`        | Property, house hunter                   | Saved interest and enquiry tracking   |
| `PropertyViewing`         | Interest, property and relevant units    | Scheduling and recording viewings     |
| `PropertyAgentAssignment` | Property or listing, agent               | Marketing, enquiries and viewings     |
| `PropertyStaffAssignment` | Property, staff member                   | Inspections and operations            |
| `MaintenanceTicket`       | Property, unit, reporter                 | Record an issue or repair request     |
| `WorkOrder`               | Ticket, property/unit, assigned provider | Authorized repair or maintenance task |
| `ServiceAgreement`        | Property and service provider            | Recurring or contracted services      |
| `PropertyDocument`        | Property, unit or related record         | General property documentation        |

A house hunter's relationship should have its own status—for example, interested, enquiry received, viewing scheduled, application submitted, withdrawn or converted to a lease. It should not occupy the tenant table just to track interest.

Likewise, an agent may work with many properties, and a property may have multiple agents over time. The assignment record should include effective dates and status rather than embedding a single agent ID in `Property`.

## 7. Property dashboard

The property overview should answer operational questions without requiring users to open each module.

Illustrative property overview — example values, not live data

Units occupied

# 18 / 24

Rent billed this month

# KES 432,000

Rent collected

# KES 360,000

Outstanding charges

# KES 72,000

Operational alerts

- Overdue rent and utility charges
- Unallocated or unmatched payments
- Missing utility readings
- Leases approaching expiry
- Open maintenance requests
- Vacant units and scheduled viewings

These figures should be calculated from the underlying records. For example, the outstanding total should distinguish overdue rent from current rent and utility balances, even if the overview displays one combined number.

## 8. Implementation order

I would implement the domain in this order to keep the first release manageable.

1. Property and physical structure: `Property`, optional `Building`, `UnitType` and `Unit`.
2. Tenancy: `Tenant`, `Lease`, `LeaseTenant`, `LeaseUnit` and lease documents.
3. Rent collection: charge rules, posted charges, payments, allocations, adjustments and receipts.
4. Utility billing: utility configurations, meters, readings, supplier bills and charge allocations.
5. Property relationships: house-hunter interests, viewings, agent assignments and staff assignments.
6. Operations: maintenance tickets, work orders and service providers.
7. Reporting and integrations: arrears reports, collection reconciliation, notifications and future payment-provider integration.

The financial ledger should be designed before rent and utility collection are implemented separately. That avoids building two competing balance systems that later need to be reconciled.

The next design issue to settle is financial allocation policy: when a tenant makes one payment covering rent and utilities, should SisoHome automatically prioritize charges using a configurable rule, or should the user manually choose which outstanding charges the payment settles? My recommendation is to support both, with explicit allocations and a configurable default policy.
