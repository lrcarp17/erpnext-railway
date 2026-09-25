# Dealerbase UX/Usability Evaluation Report

## Executive Summary

Dealerbase is a well-architected ERPNext-based dealer management system with a solid foundation for independent auto dealers. The system demonstrates thoughtful design in its core workflows (vehicle tracking, lead management, expense categorization) and innovative AI-powered document import capabilities. However, significant opportunities exist to improve the user experience, particularly around **bulk data operations**, **real-time API integrations**, and **reducing manual data entry**—areas critical for small dealers who need efficiency to compete.

---

## Current State Assessment

### Strengths

| Area | What Works Well |
|------|-----------------|
| **AI Document Import** | Excellent implementation using Claude vision to read titles, bills of sale, auction reports, and listings. The review-before-save workflow prevents errors. |
| **Inventory Assistant** | Natural language chat interface for inventory queries is innovative and reduces training overhead. |
| **Data Model** | Comprehensive schema covering the full vehicle lifecycle (acquisition → recon → frontline → sale). |
| **Expense Tracking** | Separate vehicle expenses and company expenses with flexible categories. |
| **Dashboard** | Real-time metrics for inventory counts, status breakdown, and sales performance. |
| **Workflow States** | Logical vehicle status progression with visual indicators. |

### Pain Points & Gaps

| Area | Issue | Business Impact |
|------|-------|-----------------|
| **No Bulk Import** | Only single-document AI import; no CSV/Excel support | Dealers migrating from spreadsheets or other systems face tedious manual entry |
| **No Real-time APIs** | No connections to auction platforms (Manheim, ADESA, ACV) or data providers | Missed opportunities for automated inventory feeds and pricing data |
| **Manual Expense Entry** | Company expenses require one-by-one entry | Time-consuming; no bank feed integration |
| **No Market Value APIs** | KBB, NADA, Black Book, MMR values must be manually entered | Pricing decisions lack current market context |
| **No VIN Decoder** | Vehicle specs (engine, transmission, options) entered manually | Error-prone and slow |
| **No Listing Syndication** | Listings tracked manually per platform | Can't push inventory to Facebook, CarGurus, etc. |
| **Limited Mobile UX** | Standard ERPNext responsive design; no native app | Dealers often work from the lot, not a desk |

---

## Priority Recommendations

### 1. Bulk Data Import System (HIGH PRIORITY)

**Problem:** Dealers switching from spreadsheets, other DMS systems, or starting fresh have no way to bulk-load data. This is a critical barrier to adoption.

**Recommendation:** Create a multi-format import wizard supporting:

```
┌─────────────────────────────────────────────────────────────────┐
│                    BULK IMPORT WIZARD                           │
├─────────────────────────────────────────────────────────────────┤
│  Step 1: Select Import Type                                     │
│  ○ Vehicles (CSV/Excel)                                         │
│  ○ Company Expenses (CSV/Excel/Bank Statement)                  │
│  ○ Leads (CSV/Excel)                                            │
│  ○ Acquisition History (CSV)                                    │
│                                                                  │
│  Step 2: Upload File                                            │
│  [  Drag & Drop or Browse  ]                                    │
│                                                                  │
│  Step 3: Map Columns                                            │
│  ┌────────────────┬──────────────────┬──────────────┐          │
│  │ Your Column    │ Maps To          │ Sample Data  │          │
│  ├────────────────┼──────────────────┼──────────────┤          │
│  │ VIN            │ VIN ✓            │ 1HGBH...     │          │
│  │ Year           │ Year ✓           │ 2021         │          │
│  │ Car Make       │ Make ✓           │ Honda        │          │
│  │ Price Paid     │ Acquisition Cost │ 12500        │          │
│  └────────────────┴──────────────────┴──────────────┘          │
│                                                                  │
│  Step 4: Validate & Review                                      │
│  ✓ 45 valid records                                             │
│  ⚠ 3 records with warnings (duplicate VINs)                     │
│  ✗ 2 records with errors (invalid VIN format)                   │
│                                                                  │
│  [ Download Errors ]  [ Import Valid Records ]                  │
└─────────────────────────────────────────────────────────────────┘
```

**Technical Implementation:**

```python
# New file: dealer_management/bulk_import.py

@frappe.whitelist()
def import_vehicles(file_url, column_mapping):
    """
    Import vehicles from CSV/Excel with validation.
    
    Args:
        file_url: Uploaded file URL
        column_mapping: JSON dict mapping file columns to doctype fields
    
    Returns:
        dict with imported, warnings, errors counts and details
    """
    # Implementation would:
    # 1. Parse file (pandas for Excel, csv module for CSV)
    # 2. Apply column mapping
    # 3. Validate each row (VIN format, required fields, duplicates)
    # 4. Create Dealer Vehicle records in batches
    # 5. Return detailed results for review
```

**Suggested Fields for Vehicle Import:**
- VIN (required)
- Year, Make, Model, Trim
- Stock Number
- Status
- Acquisition Date, Acquisition Cost
- Asking Price, Floor Price
- Mileage
- Title Status, Title Received (Y/N)
- Notes

---

### 2. Real-time Auction API Integration (HIGH PRIORITY)

**Problem:** Dealers buy vehicles at auction (Manheim, ADESA, ACV) and manually re-enter all data. This is duplicate work that introduces errors.

**Recommendation:** Build API integrations for major auction platforms.

**Phase 1 - ACV Auctions (Easiest to integrate):**

```
┌─────────────────────────────────────────────────────────────────┐
│                  AUCTION INTEGRATION                            │
├─────────────────────────────────────────────────────────────────┤
│  Connected Accounts:                                            │
│  ✓ ACV Auctions - John's Auto (dealer #45892)                  │
│  ○ Manheim - Not connected [Connect]                           │
│  ○ ADESA - Not connected [Connect]                             │
│                                                                  │
│  Recent Purchases (auto-imported):                              │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Today - ACV Auctions                                        ││
│  │ 2023 Toyota Camry SE | VIN: ...3905 | $18,200              ││
│  │ [View Details] [Create Vehicle] [Already Imported]         ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [ Sync Now ]  Auto-sync: Every 2 hours ✓                      │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow:**

```
Auction Platform API ──► Webhook/Poll ──► Queue ──► Process & Validate
                                                           │
                                                           ▼
                                         ┌────────────────────────────┐
                                         │ Review Pending Imports     │
                                         │ (or auto-create if enabled)│
                                         └────────────────────────────┘
                                                           │
                                                           ▼
                                         ┌────────────────────────────┐
                                         │ Dealer Vehicle Created     │
                                         │ + Vehicle Acquisition      │
                                         │ + Vehicle Condition        │
                                         │ + Vehicle Market Info (MMR)│
                                         └────────────────────────────┘
```

**API Endpoints to Implement:**

```python
# dealer_management/integrations/auction_api.py

class AuctionIntegration:
    """Base class for auction platform integrations."""
    
    def fetch_purchases(self, since_date):
        """Fetch vehicles purchased since date."""
        raise NotImplementedError
    
    def get_vehicle_details(self, auction_id):
        """Get full details for a specific auction vehicle."""
        raise NotImplementedError


class ACVIntegration(AuctionIntegration):
    """ACV Auctions API integration."""
    
    BASE_URL = "https://api.acvauctions.com"
    
    def fetch_purchases(self, since_date):
        # ACV has a REST API for dealer portal data
        pass


# Webhook receiver for real-time updates
@frappe.whitelist(allow_guest=True)
def auction_webhook():
    """Receive webhook notifications from auction platforms."""
    # Verify webhook signature
    # Queue import job
    pass
```

---

### 3. Bank Feed / Expense Import (HIGH PRIORITY)

**Problem:** Company expenses (rent, utilities, insurance, marketing) are entered manually one at a time. This is tedious and error-prone.

**Recommendation:** Support multiple expense import methods:

**Option A: CSV/OFX Bank Statement Import**

```
┌─────────────────────────────────────────────────────────────────┐
│              IMPORT BUSINESS EXPENSES                           │
├─────────────────────────────────────────────────────────────────┤
│  Upload bank statement or export:                               │
│  [  Chase_Statement_Sept2024.csv  ]                            │
│                                                                  │
│  Account: Chase Business Checking ▼                             │
│                                                                  │
│  Transactions to Import:                                        │
│  ┌──────┬────────────────────────┬──────────┬─────────────────┐│
│  │ Date │ Description            │ Amount   │ Category        ││
│  ├──────┼────────────────────────┼──────────┼─────────────────┤│
│  │ 9/15 │ ALLSTATE INS *AUTOPAY  │ -$485.00 │ Insurance     ▼ ││
│  │ 9/14 │ CARS.COM SUBSCRIPTION  │ -$99.00  │ Software      ▼ ││
│  │ 9/12 │ SHELL OIL 84729        │ -$45.00  │ [Skip - Personal]││
│  │ 9/10 │ MANHEIM PHOENIX        │ -$12,850 │ [Skip - Vehicle]││
│  │ 9/01 │ ABC PROPERTY MGMT      │ -$2,200  │ Rent/Lease    ▼ ││
│  └──────┴────────────────────────┴──────────┴─────────────────┘│
│                                                                  │
│  [ Import 3 Selected ]  Skipped: 2                             │
└─────────────────────────────────────────────────────────────────┘
```

**Option B: Plaid Integration for Direct Bank Connection**

```python
# dealer_management/integrations/banking.py

class PlaidIntegration:
    """Direct bank account connection via Plaid."""
    
    def connect_account(self, public_token):
        """Exchange public token for access token."""
        pass
    
    def fetch_transactions(self, start_date, end_date):
        """Fetch transactions from connected account."""
        pass
    
    def categorize_transaction(self, description, amount):
        """Auto-categorize based on merchant and amount."""
        # Use rules + ML for smart categorization
        pass
```

**Auto-Categorization Rules:**

```python
EXPENSE_RULES = [
    {"pattern": r"ALLSTATE|GEICO|PROGRESSIVE|STATE FARM", "category": "Insurance"},
    {"pattern": r"CARS\.COM|CARGURUS|AUTOTRADER", "category": "Software/Subscriptions"},
    {"pattern": r"FACEBOOK|GOOGLE ADS|YELP", "category": "Marketing/Advertising"},
    {"pattern": r"PROPERTY MGMT|REALTY|LANDLORD", "category": "Rent/Lease"},
    {"pattern": r"AT&T|VERIZON|COMCAST|SPECTRUM", "category": "Utilities"},
    {"pattern": r"MANHEIM|ADESA|ACV|COPART", "category": None},  # Skip - vehicle expense
]
```

---

### 4. VIN Decoder API Integration (MEDIUM PRIORITY)

**Problem:** When adding a vehicle, users manually enter year, make, model, trim, engine, transmission, drivetrain, and fuel type. This is slow and error-prone.

**Recommendation:** Integrate a VIN decoder API to auto-populate vehicle specs.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADD NEW VEHICLE                              │
├─────────────────────────────────────────────────────────────────┤
│  VIN: [1HGBH41JXMN109186              ] [Decode]               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ ✓ VIN Decoded Successfully                                 ││
│  │                                                             ││
│  │ 2021 Honda Civic EX                                        ││
│  │ Engine: 2.0L I4 DOHC 16V                                   ││
│  │ Transmission: CVT                                          ││
│  │ Drivetrain: FWD                                            ││
│  │ Body Style: Sedan                                          ││
│  │ Fuel Type: Gasoline                                        ││
│  │                                                             ││
│  │ [ Apply to Vehicle ]                                       ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Provider Options:**
- **NHTSA vPIC** (Free, official government API)
- **VINAudit** (~$0.05/decode)
- **CarMD** (~$0.10/decode)
- **DataOne** (Enterprise, most comprehensive)

**Implementation:**

```python
# dealer_management/integrations/vin_decoder.py

import requests
import frappe

NHTSA_API = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevin"

@frappe.whitelist()
def decode_vin(vin):
    """Decode VIN using NHTSA vPIC API (free)."""
    response = requests.get(f"{NHTSA_API}/{vin}?format=json")
    data = response.json()
    
    results = {r["Variable"]: r["Value"] for r in data["Results"]}
    
    return {
        "year": results.get("Model Year"),
        "make": results.get("Make"),
        "model": results.get("Model"),
        "trim": results.get("Trim"),
        "body_style": map_body_style(results.get("Body Class")),
        "engine": f"{results.get('Displacement (L)')}L {results.get('Engine Configuration')}",
        "transmission": results.get("Transmission Style"),
        "drivetrain": map_drivetrain(results.get("Drive Type")),
        "fuel_type": results.get("Fuel Type - Primary"),
        "doors": results.get("Doors"),
    }
```

---

### 5. Market Value API Integration (MEDIUM PRIORITY)

**Problem:** Dealers price vehicles based on gut feel or manually looking up KBB/NADA. The Vehicle Market Info doctype exists but requires manual data entry.

**Recommendation:** Integrate market value APIs for automated pricing guidance.

```
┌─────────────────────────────────────────────────────────────────┐
│  MARKET PRICING - 2021 Honda Civic EX                          │
├─────────────────────────────────────────────────────────────────┤
│  Mileage: 32,450 | Condition: Good | ZIP: 85001                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Source          │ Retail    │ Wholesale │ Trade-In     │  │
│  ├──────────────────┼───────────┼───────────┼──────────────┤  │
│  │  KBB             │ $23,450   │ $20,100   │ $18,900     │  │
│  │  NADA            │ $24,100   │ $21,200   │ $19,500     │  │
│  │  Black Book      │ $23,800   │ $20,500   │ $19,200     │  │
│  │  MMR (Manheim)   │    —      │ $20,350   │     —       │  │
│  └──────────────────┴───────────┴───────────┴──────────────┘  │
│                                                                  │
│  Suggested Asking Price: $23,500 - $24,500                      │
│  Your Cost Basis: $19,200                                       │
│  Projected Gross Profit: $4,300 - $5,300                        │
│                                                                  │
│  [ Apply $23,900 as Asking Price ]                              │
└─────────────────────────────────────────────────────────────────┘
```

**Provider Options:**
- **Marketcheck API** - Aggregates listings for comp analysis
- **J.D. Power / NADA** - Official used car values
- **Black Book** - Dealer-focused wholesale values
- **Manheim MMR** - Wholesale auction values (via Manheim API)

---

### 6. Listing Syndication (MEDIUM PRIORITY)

**Problem:** Dealers manually post to each listing platform (Facebook, Craigslist, CarGurus, etc.) and track listings separately.

**Recommendation:** Build one-click syndication to major platforms.

```
┌─────────────────────────────────────────────────────────────────┐
│  LISTING SYNDICATION - 2021 Honda Civic EX                     │
├─────────────────────────────────────────────────────────────────┤
│  Platforms:                                                     │
│  ┌─────────────────┬──────────┬─────────────┬────────────────┐│
│  │ Platform        │ Status   │ Views       │ Actions        ││
│  ├─────────────────┼──────────┼─────────────┼────────────────┤│
│  │ Facebook        │ ● Active │ 234         │ [View] [Pause] ││
│  │ CarGurus        │ ● Active │ 89          │ [View] [Pause] ││
│  │ Craigslist      │ ○ Draft  │ —           │ [Post]         ││
│  │ Cars.com        │ ○ Off    │ —           │ [Enable]       ││
│  │ Dealer Website  │ ● Active │ 56          │ [View]         ││
│  └─────────────────┴──────────┴─────────────┴────────────────┘│
│                                                                  │
│  [ Sync All Listings ]  Last sync: 2 hours ago                  │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Approach:**
- Facebook Marketplace: Graph API
- CarGurus/Cars.com/Autotrader: ADF/XML feeds
- Craigslist: Template generation (manual post)

---

## Quick Wins (LOW EFFORT, HIGH IMPACT)

### 1. Add CSV Export on All Lists

Currently missing bulk export functionality. Add "Export to CSV" button on:
- Vehicle list
- Lead list
- Company expenses
- Vehicle expenses report

### 2. Duplicate Detection on Import

When adding a vehicle or importing:
- Check for existing VIN
- Show warning with link to existing record
- Option to update vs. create new

### 3. Smart Defaults

Reduce clicks by remembering user preferences:
- Default acquisition source (most-used)
- Default expense categories
- Default listing platforms

### 4. Keyboard Shortcuts

Power users want speed:
- `N` - New vehicle
- `L` - New lead  
- `E` - New expense
- `/` - Focus search
- `?` - Show shortcuts help

### 5. Photo Gallery Improvements

Current photo handling is basic:
- Add drag-to-reorder
- Add bulk photo upload progress indicator
- Add "set as primary" in gallery view
- Add photo download as ZIP

---

## Mobile UX Improvements

### Lot Mode (New Feature Concept)

A simplified mobile interface for when dealers are physically on the lot:

```
┌─────────────────────────────────────────┐
│  ☰  LOT MODE           🔍  📷  +        │
├─────────────────────────────────────────┤
│                                         │
│  Quick Actions:                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ 📷      │ │ 🎤      │ │ ➕      │  │
│  │ Scan    │ │ Voice   │ │ Quick   │  │
│  │ Title   │ │ Note    │ │ Add     │  │
│  └─────────┘ └─────────┘ └─────────┘  │
│                                         │
│  Recent Vehicles:                       │
│  ┌─────────────────────────────────┐   │
│  │ [IMG] 2023 Toyota Camry        │   │
│  │       VIN: ...3905  Frontline  │   │
│  │       $24,500  ⚠️ No photos    │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ [IMG] 2022 Honda Accord        │   │
│  │       VIN: ...8821  In Recon   │   │
│  │       $22,900  ✓ Ready         │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

Features:
- VIN barcode scanner (camera)
- Voice notes that transcribe to vehicle notes
- Quick status updates (swipe gestures)
- Offline support for lot walkthroughs

---

## Data Architecture Recommendations

### 1. API Framework

Create a dedicated API module for integrations:

```
dealer_management/
├── integrations/
│   ├── __init__.py
│   ├── base.py              # Base integration class
│   ├── auction/
│   │   ├── acv.py
│   │   ├── manheim.py
│   │   └── adesa.py
│   ├── market_data/
│   │   ├── kbb.py
│   │   ├── nada.py
│   │   └── blackbook.py
│   ├── banking/
│   │   ├── plaid.py
│   │   └── csv_import.py
│   └── vin_decoder/
│       └── nhtsa.py
├── bulk_import/
│   ├── __init__.py
│   ├── vehicle_import.py
│   ├── expense_import.py
│   └── lead_import.py
└── api/
    ├── __init__.py
    ├── vehicles.py          # REST API for vehicles
    ├── expenses.py          # REST API for expenses
    └── webhooks.py          # Inbound webhooks
```

### 2. New DocTypes Needed

```
Integration Settings (Single DocType)
├── auction_integrations (Child Table)
│   ├── platform (ACV, Manheim, ADESA)
│   ├── api_key
│   ├── dealer_id
│   ├── enabled
│   └── auto_import
├── market_data_integrations (Child Table)
│   ├── provider (KBB, NADA, etc.)
│   ├── api_key
│   └── enabled
└── banking_integrations (Child Table)
    ├── plaid_access_token
    └── last_sync_date

Import Job (Master DocType)
├── import_type (Vehicle, Expense, Lead)
├── source_file
├── status (Pending, Processing, Complete, Failed)
├── total_records
├── imported_count
├── error_count
├── error_details (JSON)
└── imported_by
```

### 3. Webhook Endpoints

Expose REST API endpoints for external systems:

```
POST /api/method/dealer_management.api.webhooks.auction_purchase
POST /api/method/dealer_management.api.webhooks.lead_submission  
POST /api/method/dealer_management.api.webhooks.inventory_update
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] CSV/Excel bulk import for vehicles
- [ ] CSV export on all lists
- [ ] VIN decoder integration (NHTSA - free)
- [ ] Duplicate detection

### Phase 2: Expense Management (Weeks 3-4)
- [ ] Bank statement CSV/OFX import
- [ ] Auto-categorization rules
- [ ] Expense reporting improvements

### Phase 3: Auction Integration (Weeks 5-8)
- [ ] ACV Auctions API integration
- [ ] Webhook receiver for real-time imports
- [ ] Import queue and review workflow

### Phase 4: Market Data (Weeks 9-10)
- [ ] Market value API integration (pick one provider)
- [ ] Pricing recommendations on vehicle form

### Phase 5: Advanced Features (Ongoing)
- [ ] Listing syndication
- [ ] Mobile lot mode
- [ ] Plaid banking integration

---

## Conclusion

Dealerbase has a strong foundation with excellent AI document import and a well-designed data model. The primary opportunities for improvement center on **reducing manual data entry** through:

1. **Bulk import capabilities** - Critical for dealer onboarding
2. **Auction platform integrations** - Eliminates double-entry for vehicle purchases
3. **Bank feed/expense import** - Streamlines financial tracking
4. **VIN decoder** - Auto-populates vehicle specs

These improvements would dramatically reduce the time dealers spend on data entry, allowing them to focus on buying, selling, and servicing customers. The suggested implementations leverage existing ERPNext patterns and can be built incrementally without disrupting current functionality.

---

*Report prepared by UX Consultant | September 2026*
