# Implementation Notes & Priorities

## Phase 1: Core Vehicle Management (MVP)

### Priority 1 - Foundation
Create these DocTypes first as they form the foundation:

1. **Expense Category** (Master)
   - Simple setup table
   - Pre-populate with default categories

2. **Listing Platform** (Master)
   - Simple setup table
   - Pre-populate common platforms

3. **Acquisition Source** (Master)
   - Simple setup table
   - Add common auction houses

### Priority 2 - Vehicle Core
4. **Vehicle** (Master)
   - Core vehicle fields only (VIN, year, make, model, etc.)
   - Status field
   - Basic pricing fields
   - Child tables: Photos, Expenses, Listings, Notes

### Priority 3 - Acquisition & Condition
5. **Vehicle Acquisition** (Linked)
   - All cost tracking fields
   - Link back to Vehicle

6. **Vehicle Condition** (Linked)
   - Inspection checklist
   - Rating system

### Priority 4 - Market & Sales
7. **Vehicle Market Info** (Linked)
   - Market values
   - Comparables

8. **Vehicle Sale** (Linked)
   - Full sale transaction tracking

---

## Phase 2: Lead Management

9. **Lead** (Master)
   - Contact information
   - Qualification fields
   - Child tables: Vehicle Interests, Activities

---

## Phase 3: Company Financials

10. **Company Expense** (Master)
    - Non-vehicle expenses
    - Recurring expense support

---

## ERPNext Custom App Structure

```
dealer_management/
├── dealer_management/
│   ├── __init__.py
│   ├── hooks.py
│   ├── dealer_management/
│   │   ├── doctype/
│   │   │   ├── vehicle/
│   │   │   │   ├── vehicle.json
│   │   │   │   ├── vehicle.py
│   │   │   │   └── vehicle.js
│   │   │   ├── vehicle_photo/
│   │   │   ├── vehicle_expense/
│   │   │   ├── vehicle_listing/
│   │   │   ├── vehicle_note/
│   │   │   ├── vehicle_acquisition/
│   │   │   ├── vehicle_condition/
│   │   │   ├── vehicle_market_info/
│   │   │   ├── vehicle_sale/
│   │   │   ├── lead/
│   │   │   ├── lead_vehicle_interest/
│   │   │   ├── lead_activity/
│   │   │   ├── company_expense/
│   │   │   ├── expense_category/
│   │   │   ├── listing_platform/
│   │   │   └── acquisition_source/
│   │   └── report/
│   │       ├── inventory_aging/
│   │       ├── profitability_report/
│   │       ├── lead_pipeline/
│   │       └── expense_summary/
│   └── public/
│       └── js/
└── setup.py
```

---

## Key Customizations

### Auto-Naming Rules

```python
# Vehicle
autoname = "format:VH-{YYYY}-{#####}"

# Lead  
autoname = "format:LD-{YYYY}-{#####}"

# Company Expense
autoname = "format:EXP-{YYYY}-{MM}-{#####}"
```

### Calculated Fields Script

```python
# vehicle.py
import frappe
from frappe.utils import date_diff, today, flt

class Vehicle(Document):
    def validate(self):
        self.calculate_days_on_lot()
        self.calculate_total_investment()
        self.calculate_potential_profit()
    
    def calculate_days_on_lot(self):
        if self.lot_date:
            self.days_on_lot = date_diff(today(), self.lot_date)
        else:
            self.days_on_lot = 0
    
    def calculate_total_investment(self):
        acquisition_cost = 0
        if self.acquisition:
            acq = frappe.get_doc("Vehicle Acquisition", self.acquisition)
            acquisition_cost = flt(acq.total_acquisition_cost)
        
        expense_total = sum([flt(e.amount) for e in self.expenses])
        self.total_investment = acquisition_cost + expense_total
    
    def calculate_potential_profit(self):
        self.potential_profit = flt(self.asking_price) - flt(self.total_investment)
```

### Client-Side Validations

```javascript
// vehicle.js
frappe.ui.form.on('Vehicle', {
    vin: function(frm) {
        // VIN validation (17 characters, no I, O, Q)
        if (frm.doc.vin && frm.doc.vin.length !== 17) {
            frappe.msgprint(__('VIN must be exactly 17 characters'));
        }
    },
    
    floor_price: function(frm) {
        if (frm.doc.floor_price > frm.doc.asking_price) {
            frappe.msgprint(__('Floor price cannot exceed asking price'));
        }
    }
});
```

---

## Dashboard Configuration

### Vehicle Workspace
- Shortcuts: Add Vehicle, Vehicle List, Inventory Aging Report
- Number Cards: Total Inventory, Avg Days on Lot, Total Value
- Quick Lists: Recent Additions, Aging Vehicles (60+ days)

### Lead Workspace  
- Shortcuts: Add Lead, Lead List, Lead Pipeline
- Number Cards: New Leads (This Week), Appointments Today, Hot Leads
- Quick Lists: Follow-ups Due, Recent Inquiries

---

## Sample Data / Fixtures

### Expense Categories
```json
[
    {"category_name": "Detail", "expense_type": "Vehicle", "parent_category": "Reconditioning"},
    {"category_name": "Paint/Body", "expense_type": "Vehicle", "parent_category": "Reconditioning"},
    {"category_name": "Mechanical", "expense_type": "Vehicle", "parent_category": "Reconditioning"},
    {"category_name": "Tires", "expense_type": "Vehicle", "parent_category": "Reconditioning"},
    {"category_name": "Inspection/Smog", "expense_type": "Vehicle"},
    {"category_name": "Transport", "expense_type": "Vehicle"},
    {"category_name": "Rent", "expense_type": "Company"},
    {"category_name": "Insurance", "expense_type": "Company"},
    {"category_name": "Marketing", "expense_type": "Company"},
    {"category_name": "Utilities", "expense_type": "Company"}
]
```

### Listing Platforms
```json
[
    {"platform_name": "Facebook Marketplace", "platform_type": "Social", "cost_type": "Free"},
    {"platform_name": "Craigslist", "platform_type": "Classified", "cost_type": "Per Listing"},
    {"platform_name": "CarGurus", "platform_type": "Marketplace", "cost_type": "Subscription"},
    {"platform_name": "Cars.com", "platform_type": "Marketplace", "cost_type": "Subscription"},
    {"platform_name": "Autotrader", "platform_type": "Marketplace", "cost_type": "Subscription"},
    {"platform_name": "OfferUp", "platform_type": "Marketplace", "cost_type": "Free"},
    {"platform_name": "eBay Motors", "platform_type": "Marketplace", "cost_type": "Per Listing"}
]
```

---

## Integration Considerations

### VIN Decoder Integration
- NHTSA free API: `https://vpic.nhtsa.dot.gov/api/`
- Auto-populate: year, make, model, body style, engine, transmission
- Implement as server script triggered on VIN entry

### Market Value APIs (Paid)
- Black Book API
- J.D. Power (NADA)
- KBB API
- Consider caching results to reduce API calls

### Photo Management
- Compress images on upload (use Frappe hooks)
- Consider CDN for high-traffic scenarios
- Generate thumbnails for list views

---

## Security / Permissions

### Roles
1. **Dealer Owner** - Full access to all
2. **Sales Manager** - Full vehicle/lead access, view company expenses
3. **Salesperson** - Own leads, view vehicles, no expenses
4. **Reconditioning** - Vehicle expenses only, view vehicle info

### Permission Matrix

| DocType | Owner | Sales Mgr | Salesperson | Recon |
|---------|-------|-----------|-------------|-------|
| Vehicle | CRUD | CRUD | R | R |
| Vehicle Expense | CRUD | CRUD | R | CRU |
| Lead | CRUD | CRUD | Own | - |
| Company Expense | CRUD | R | - | - |
| Vehicle Sale | CRUD | CRUD | R | - |

---

## Future Enhancements

1. **Mobile App** - Lot walk condition inspections
2. **SMS Integration** - Lead follow-up reminders
3. **Document Generation** - Bill of sale, buyer's guide
4. **Payment Tracking** - For BHPH dealers
5. **Multi-Location** - Support for multiple lots
6. **Auction Integration** - Direct bidding integration
7. **Website Sync** - Auto-publish to dealer website
8. **Analytics Dashboard** - Advanced reporting with charts
