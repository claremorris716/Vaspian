# Vaspian OS — Full User Manual

**Version:** 2 (Updated)
**Platform:** Vaspian OS Internal Operations App
**Audience:** Contract Admins, Project Managers, Installers, Accounting, Sales, Operations Management

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Navigation & Layout](#2-navigation--layout)
3. [Today View](#3-today-view)
4. [Overview View](#4-overview-view)
5. [Customers](#5-customers)
6. [Projects & Orders](#6-projects--orders)
7. [Contract Admin Workflow](#7-contract-admin-workflow)
8. [Project Manager Workflow](#8-project-manager-workflow)
9. [Installer Workflow](#9-installer-workflow)
10. [Accounting Workflow](#10-accounting-workflow)
11. [Tasks](#11-tasks)
12. [Inventory](#12-inventory)
13. [Services Reference](#13-services-reference)
14. [Staff Management](#14-staff-management)
15. [Search](#15-search)
16. [Zoho CRM Integration](#16-zoho-crm-integration)
17. [Risk Scoring](#17-risk-scoring)
18. [Gate System](#18-gate-system)
19. [Stage Pipeline Reference](#19-stage-pipeline-reference)

---

## 1. Introduction

Vaspian OS is the internal operations platform for Vaspian's go-to-market and delivery workflow. It tracks every customer order from initial CRM entry through activation, installation, billing, and support handoff — giving every team a real-time view of where each project stands, what's blocking it, and what action is needed next.

### Core Philosophy

- **One source of truth** — all roles (Contract Admin, PM, Installer, Accounting, Sales) see the same project state.
- **Gate-enforced progression** — a project cannot advance to the next stage until all required criteria are met.
- **Risk-first dashboard** — the system surfaces blocked, aging, and unpaid items automatically so nothing falls through the cracks.
- **Role-scoped views** — each department sees a default view scoped to their active work, with the option to expand to all projects.

> 📝 **Note on sample data:** Sample data shown in the app (names such as Sarah Mitchell, Mike Torres, Dave Kowalski, etc.) uses fictional placeholder names and does not reflect actual Vaspian staff assignments or real customer records.

### What Vaspian OS Is Not

- It is **not** a phone system provisioning tool. Provisioning runs separately through **Syl** (`syl.in.vaspian.com`) and **Silhouette PBX**. A project reaching "Client Activated" in OS does not guarantee provisioning is complete in those systems.
- It is **not** a financial reporting system. Billing figures shown are pipeline estimates for operational visibility — not for revenue recognition or accounting records.
- It is **not** connected to Zoho Desk (support tickets). The Zoho integration is CRM-only (deals, contacts, accounts).

---

## 2. Navigation & Layout

### Top Navigation Bar

The nav bar contains tabs for every major view. The active tab is highlighted in blue. Click any tab to switch views. The current tabs are:

| Tab | Role |
|---|---|
| Today | Dashboard — critical/at-risk items for all active projects |
| Overview | Filterable table of all active orders with sorting |
| Customers | Customer list and per-customer project detail |
| Projects | All projects with sorting, filtering, and export |
| Sales | Read-only pipeline view for Sales team |
| Contract Admin | CA workflow — stages CRM Entry through Handed to PM |
| Project Manager | PM workflow — Plan through Handed to Support |
| Installer | Installer workflow — Survey through Install Complete |
| Inventory | Stock levels, catalog management, and allocation |
| Accounting | Billing stages — Scope Review through Closed |
| Tasks | Cross-role task tracking across all active projects |
| Staff | Team roster and role assignments |
| Search | Global search across customers, projects, staff, and logs |

### Status Bar

Below the nav bar is a live status strip showing:
- Critical project count (links to Today)
- At-risk count (links to Today)
- Total unpaid invoices
- Count of closed/paid projects
- Total MRR across active pipeline
- Customer / project / staff counts

### Global Buttons

- **🔗 Zoho** — opens the Zoho CRM import modal to pull a deal by Deal ID
- **+ New** — opens a blank new project modal

---

## 3. Today View

The Today view is the default landing screen. It shows items requiring immediate attention:

| Section | Contents |
|---|---|
| 🔴 Critical | Projects with risk score ≥ 50 |
| 🟡 At Risk | Projects with risk score 25–49 |
| 📦 Inventory Alerts | Items at or below low-stock threshold |
| 💰 Revenue at Risk | Invoiced, unpaid items older than 7 days |

Each row shows company name, project name, stage badge, risk score, and active risk flags (Aging, Blocked, Unpaid, Stock Short, Ship Risk). Click any row to open the full project modal.

If no critical items exist, an "All clear" message is displayed.

---

## 4. Overview View

The Overview view provides a single filterable, sortable table of all active (non-closed) orders across all departments.

### Filters

| Filter | Options |
|---|---|
| Stage Group | All / Pre-Contract / PM Pipeline / Operations / Complete |
| Rep | All / individual sales reps drawn from customer records |
| Status | All / Blocked / Aging / On Track / Unpaid |

### Sortable Columns

Click any column header to sort ascending or descending:

- **Company** — alphabetical
- **Stage** — pipeline order
- **Risk Score** — numerical (default sort, high to low)
- **Revenue** — total equipment + install invoice amounts
- **Install Date** — chronological
- **Days in Stage** — number of days in the current stage; colored green/amber/red relative to the stage's bottleneck threshold

### Use Cases

- Operations Manager review: see the full active pipeline at a glance filtered by rep or stage group
- Pre-meeting prep: filter to a single rep's orders to review status
- Aging audit: sort by Days in Stage descending to find stalled orders

---

## 5. Customers

### Customer List

Shows all customers with company name, contact, rep, Zoho Account ID, project counts, and MRR. Use the search bar to filter by company, contact, rep, or Zoho Account ID. Click **Export** to download a CSV of the filtered list.

Click a customer row or the **Projects →** button to open the Customer Detail view.

### Customer Detail

Shows the selected customer's full profile and all associated projects. From here you can:

- **+ New Project (Manual)** — create a blank project for this customer
- **🔗 Import from Zoho** — import a deal from Zoho CRM and auto-link it to this customer

Active and archived projects are listed separately. Click any project card to open the full project modal.

### Creating / Editing Customers

Click **+ New Customer** from the Customer List, or click **Edit** on an existing customer. Required field: Company name. Sales Rep is selected from active staff with the Sales role.

---

## 6. Projects & Orders

Every delivery engagement is tracked as a **Project** (also called an **Order**) associated with a customer.

### Project Modal — Tabs

| Tab | Purpose |
|---|---|
| Details | Core fields: name, stage, dates, services, assigned staff, site survey, flags, notes |
| Gates | Shows all requirements to advance from the current stage; green = met, red = missing |
| Tasks | Role-grouped task checklist with completion notes and dates |
| Inventory | Allocate, reserve, stage, and deliver catalog items for this project |
| Billing | Invoice amounts, payment dates, method, invoiced/paid flags, GM estimate |
| Go-Live | Pre-activation checklist (9 items) |
| Handoff | Support handoff checklist with contacts, instructions, and confirmations |
| Contact Log | Timestamped log of calls, emails, texts, and notes linked to pipeline stages |
| Documents | Attach and manage documents (contracts, surveys, invoices, reports) |

### Key Fields

- **Stage** — the current pipeline stage; changing it manually bypasses gates (use the advance button to enforce gate logic)
- **Zoho Deal ID** — links the project to a Zoho CRM deal
- **Lines** — number of phone lines; used to calculate MRR
- **Services** — select all applicable service types; drives MRR calculation
- **Install Date / Port Date** — used in risk scoring and installer scheduling
- **Assigned Staff** — CA, PM, Installer, Accounting each have a dedicated assignment field
- **Mark Blocked** — sets the `riskBlocked` flag; adds 25 points to risk score immediately

### Advancing a Stage

The **→ [Next Stage]** button in the modal footer advances the project. It is locked (grayed with 🔒) unless all gates for the current stage are met. When unlocked, clicking it moves the project to the next stage and resets the stage entry date.

### Deleting a Project

Click **Delete** in the modal footer. This is permanent. Consider using the **Archive** flag instead to preserve history.

---

## 7. Contract Admin Workflow

**Scope:** Stages CRM Entry → Order Confirmed → Welcome Sent → Handed to PM

The Contract Admin (CA) view defaults to projects in CA stages ("CA Stages Only" scope). Toggle to "All Projects" to see the full pipeline.

### CA Checklist per Stage

**CRM Entry:**
- Company, contact, phone, rep filled in
- 1+ service selected
- Zoho Deal ID set
- Billing amounts > 0

**Order Confirmed:**
- Billing amounts > 0
- 1+ service selected

**Welcome Sent:**
- Welcome Email task complete
- Site survey status set (or marked Not Needed)
- PM assigned

**Handed to PM:**
- No additional gates (PM takes over)

### Key Actions in CA Stage

- Assign a Contract Admin in the Details tab
- Set billing amounts (Equipment Invoice, Install Invoice)
- Select services and enter line count
- Complete the "Send Welcome Email" task
- Set PM assignment before advancing from Welcome Sent

---

## 8. Project Manager Workflow

**Scope:** Stages Plan → Kickoff Scheduled → Kickoff Complete → Port Ordered → Install & Port Date Set → Training Complete → Activation Ready → Client Activated → Handed to Support; plus all Installer stages

The PM view defaults to PM/Install stages. Toggle between Kanban (default) and List views.

### PM Gate Reference

**Plan:** Install date set, Installer assigned

**Kickoff Scheduled:** Kickoff logged in Contact Log (type = Call, linked stage = Kickoff Call Complete)

**Kickoff Complete:** Port numbers documented, Port date confirmed

**Port Ordered:** Install date set, Customer confirmation logged (linked stage = Install Date Confirmed)

**Install & Port Date Set:** Equipment reserved (all required items), Installer confirmed

**Training Complete:** Go-Live Checklist 100% complete

**Activation Ready:** Equipment payment confirmed

**Client Activated:** Support Handoff complete (all 4 handoff fields filled)

### Kanban View

The Kanban board shows one column per stage with project cards. Each card shows company, project name, assigned PM, risk badge, aging pill, install date, and an advance button if gates are met.

---

## 9. Installer Workflow

**Scope:** Stages Survey Scheduled → Survey Complete → Survey Approved → Install Scheduled → Installing → Install Complete

The Installer view shows two sections:
1. **Surveys** — projects with required site surveys in Required, Scheduled, or Blocked status
2. **Active Jobs** — projects in Install stages

### Survey Gate Reference

**Survey Scheduled:** Survey date set, Tech assigned

**Survey Complete:** Report attached, Scope change noted, Readiness set

**Survey Approved:** Scope approved by Accounting, Equipment reserved (at least 1 unit)

**Install Scheduled:** Equipment on-site (Installer Checked In flag)

**Installing:** All lines tested (task), Install report submitted (task), PM notified (task)

### Install Scheduling

The installer list is sorted by install date (soonest first). Set the **Install Date** in the project Details tab. Assign the **Installer** from staff with the Installer role.

---

## 10. Accounting Workflow

**Scope:** Stages Scope Review → Equipment Invoiced → Payment Confirmed → Install Invoiced → Closed

The Accounting view defaults to Accounting stages. Toggle between Kanban and List.

### Accounting Gate Reference

**Scope Review:** Scope locked (Acc Scope Locked flag)

**Equipment Invoiced:** Payment recorded (payment date + method)

**Payment Confirmed:** Install confirmed by installer (Install Report task complete)

**Install Invoiced:** Install invoice date set, Install payment confirmed

### Quick-Action Buttons in Accounting List

Each project row has inline action buttons based on billing state:
- **📄 Invoice** — marks project as invoiced, sets equipment invoice date to today (available when Install Complete and not yet invoiced)
- **✓ Equip Paid** — records equipment payment date and marks paid
- **✓ Install Paid** — records install payment date (available when equipment is paid and install invoice amount > 0)

### Billing Tab

The Billing tab in the project modal contains:
- Equipment Invoice Amount and Date
- Equipment Payment Date and Method
- Install Invoice Amount, Date, and Payment Date
- Invoiced / Paid checkboxes

The summary row shows Total Revenue and Gross Margin estimate.

> ⚠️ **Pipeline estimate only** — MRR and margin figures are app estimates for pipeline visibility. Do not use for revenue forecasting or financial reporting.

---

## 11. Tasks

The Tasks view shows all project tasks across every active project, filterable by role, assignee, and completion status.

### Task Groups per Project

| Group | Tasks |
|---|---|
| Contract Admin | Send Welcome Email, Schedule Confirmation Call, Complete Confirmation Call, Hand Off to PM |
| Project Manager | Create Project Plan, Kickoff Call Complete, Training Scheduled |
| Installer | Schedule Site Survey, Complete Site Survey, Submit Survey Report, All Lines Tested, Install Report Submitted, PM Notified of Completion |
| Accounting | Send Invoice, Confirm Payment Received |

Tasks can be checked off with an optional note. Completed tasks record a completion date.

Click a project row in Tasks view to expand the task panel inline.

---

## 12. Inventory

Inventory tracks physical and virtual equipment used across projects.

### Stock Tab

Shows all active SKUs with current quantities, reservations, and availability. Color coding:
- 🔴 **SHORT** — available quantity is negative (over-reserved)
- 🟡 **Low** — available ≤ low-stock threshold
- 🟢 **OK** — sufficient stock

Use the **±** buttons for single-unit adjustments, or the **Receive** field to add a bulk quantity.

### Catalog Tab

Manage SKUs, categories, models, conditions, unit costs, and active/inactive status. Click **+ New Item** to add a SKU. Click any model name in Stock view to edit that item.

### Project Inventory Allocation

Inside the project modal's Inventory tab, search the catalog and allocate items to a specific project:
- **Required** — units needed for this project
- **Reserved** — units held in stock for this project (should match Required; red border if short)
- **Staged** — units physically staged/shipped
- **Delivered** — units confirmed delivered to site

Inventory totals (reserved, staged) are computed across all projects automatically.

---

## 13. Services Reference

The following services are tracked per project. MRR is calculated as `(sum of per-seat rates × lines)` where applicable.

### Service Pricing

| Service | List Price | Notes |
|---|---|---|
| **Phone** (Business Phone System) | $25/seat/month | Unlimited calling, multidesking (4 devices), virtual receptionist, call groups, mobile softphone, 99.999% uptime. Includes One Portal and One Phone access. |
| **Soft Phone** (Deluxe Remote Worker) | $25/seat/month base | Standard tier at $25/seat. Deluxe Remote Worker tier includes full UC features at a higher price — confirm tier with the customer before quoting. |
| **Text** (TrueText Business Messaging) | $50–$500/month | Plan-based pricing, not per-seat. $100 one-time setup fee applies. Quote based on message volume tier, not seat count. |
| **Dialer** (Predictive Dialer) | $100/seat/month | AI-powered outbound dialer. Eliminates voicemail drops and busy signal time. Per-seat pricing. |
| **Speech Analytics** (BlueMesh AI) | $25–$50/user/month | Transcription, sentiment analysis, keyword extraction. Collections-industry installs map to the **TrueCollect** product line — use TrueCollect pricing and documentation for those deployments. |

### Additional Services (Not Yet in OS)

| Service | Status | How to Track |
|---|---|---|
| **Call2Teams** (Microsoft Teams Direct Routing) | No OS service tag yet | Document in the project Notes field until a service tag is added |
| **Voice Broadcasting** | Not tracked per-seat | Note in project; rate is $0.015/minute |
| **One Click** (Chrome dialing extension) | Included with Phone | No separate line item |

### Notes on Soft Phone Tiers

The "Soft Phone" service tag in OS represents the base softphone/remote worker product. If a customer is on the **Deluxe Remote Worker** tier (which includes full unified communications features), note this in the project or billing notes — the standard $25/seat estimate in OS will understate actual MRR.

### Notes on Speech Analytics / TrueCollect

BlueMesh AI runs on Vaspian's local GPU infrastructure (`ai00/ai01.vaspian.com`) — it is not a third-party cloud service. For collections-industry customers, this product is positioned and priced as **TrueCollect**. Ensure the correct product name is used in customer-facing documents and Zoho records for these deployments.

---

## 14. Staff Management

The Staff view shows all team members with their roles, contact info, active project count, and active/inactive status.

### Roles

| Role | Color | Views Scoped To |
|---|---|---|
| Contract Admin | Purple | Contract Admin view |
| Project Manager | Blue | Project Manager view |
| Installer | Orange | Installer view |
| Accounting | Green | Accounting view |
| Sales | Yellow | Sales view (read-only) |

Staff members can hold multiple roles. Active/inactive toggle controls whether they appear in assignment dropdowns.

### Adding / Editing Staff

Click **+ Add Staff** or click any row to open the staff modal. Required field: Full Name. Select all applicable roles. Deactivating a staff member removes them from assignment dropdowns but preserves their name on existing projects.

---

## 15. Search

Global search covers:
- Customer company names, contacts, phones
- Project names, Zoho Deal IDs, notes
- Contact log entries
- Staff names, emails, roles

Type at least 2 characters to trigger results. Results are grouped by type (Customers, Projects, Staff). Click a customer result to open Customer Detail. Click a project result to open the project modal.

---

## 16. Zoho CRM Integration

Vaspian OS integrates with **Zoho CRM** (not Zoho Desk). The integration is read-only import — data flows from Zoho into OS, not the reverse.

### Importing a Deal

1. Click **🔗 Zoho** in the top nav bar, or click **🔗 Import from Zoho** from a Customer Detail page.
2. Enter the Zoho Deal ID (format: ZD-XXXX).
3. Click **Fetch Deal** to retrieve deal data.
4. Review the populated fields (company, contact, services, lines, billing amounts, rep, notes).
5. Click **✓ Create Project** to create the project in OS linked to the deal.

If importing from the top nav, a new customer record is created automatically if the company doesn't match an existing customer. If importing from Customer Detail, the project is linked to that customer.

### Zoho Deal ID vs. Zoho Account ID

- **Zoho Deal ID** (`ZD-XXXX`) — links a specific project/order to a CRM deal; stored on the project
- **Zoho Account ID** (`ZA-XXXX`) — links a customer company to a CRM account; stored on the customer

Both IDs are searchable in Global Search.

---

## 17. Risk Scoring

Each project has a computed **risk score** from 0–100. The score is recalculated dynamically based on current project state.

### Scoring Components

| Condition | Max Points | Flag |
|---|---|---|
| Stage age exceeds bottleneck threshold | +30 | `aging` |
| Project marked Blocked | +25 | `blocked` |
| Equipment invoice unpaid > 7 days | +20 | `unpaid` |
| Inventory short (required > reserved) | +15 | `inv_short` |
| Install ≤ 7 days away, no equipment staged | +10 | `ship_risk` |

### Risk Bands

| Score | Color | Label |
|---|---|---|
| 0–24 | 🟢 Green | On Track |
| 25–49 | 🟡 Amber | At Risk |
| 50–100 | 🔴 Red | Critical |

### Stage Bottleneck Thresholds

Each stage has a defined maximum expected duration in days. Exceeding it triggers the aging flag. Example thresholds: CRM Entry = 2 days, Port Ordered = 5 days, Payment Confirmed = 7 days.

---

## 18. Gate System

Gates are per-stage requirements that must be met before a project can advance. They are checked in real time and displayed in the **Gates** tab of the project modal.

- ✓ Green = gate met
- ✗ Red = gate not met (labeled REQUIRED)

The **advance button** (→ Next Stage) is locked until all gates pass. A project can still be manually moved to any stage from the Stage dropdown in the Details tab — but this bypasses gate enforcement and should only be done deliberately.

See Section 7–10 for per-role gate details, and Section 19 for the full stage pipeline.

---

## 19. Stage Pipeline Reference

Projects flow through one of four department pipelines. All stages are part of a single ordered sequence:

### Contract Admin Stages
1. CRM Entry
2. Order Confirmed
3. Welcome Sent
4. Handed to PM

### Project Manager Stages
5. Plan
6. Kickoff Scheduled
7. Kickoff Complete
8. Port Ordered
9. Install & Port Date Set
10. Training Complete
11. Activation Ready
12. Client Activated
13. Handed to Support

### Installer Stages
14. Survey Scheduled
15. Survey Complete
16. Survey Approved
17. Install Scheduled
18. Installing
19. Install Complete

### Accounting Stages
20. Scope Review
21. Equipment Invoiced
22. Payment Confirmed
23. Install Invoiced
24. Closed

---

*Vaspian OS — Internal Operations Platform | Buffalo, NY | vaspian.com*
