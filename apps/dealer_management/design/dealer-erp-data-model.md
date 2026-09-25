# ERPNext Data Model for Independent Auto Dealers

## Overview

This document outlines an ERPNext-based data model for small independent auto dealers to manage vehicle acquisition, inventory, expenses, pricing, listings, and sales.

---

## DocType Hierarchy

```
Vehicle (Master)
├── Vehicle Photo (Child Table)
├── Vehicle Expense (Child Table)
├── Vehicle Listing (Child Table)
└── Vehicle Note (Child Table)

Vehicle Acquisition (Linked)
Vehicle Condition (Linked)
Vehicle Market Info (Linked)
Vehicle Sale (Linked)

Lead (Master)
├── Lead Vehicle Interest (Child Table)
└── Lead Activity (Child Table)

Company Expense (Master)
Expense Category (Master)
Listing Platform (Master)
Acquisition Source (Master)
Lienholder (Master)
```

---

## Core DocTypes

### 1. Vehicle (Master DocType)

The central entity representing a vehicle in inventory.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| **Basic Info** |||
| `vehicle_id` | Data | Auto-generated unique ID (e.g., VH-2024-0001) |
| `vin` | Data (unique) | 17-character VIN |
| `stock_number` | Data | Internal stock number |
| `status` | Select | Available, Pending Sale, Sold, Wholesale, Problem |
| **Vehicle Details** |||
| `year` | Int | Model year |
| `make` | Data | Manufacturer (e.g., Toyota) |
| `model` | Data | Model name (e.g., Camry) |
| `trim` | Data | Trim level (e.g., SE, XLE) |
| `body_style` | Select | Sedan, SUV, Truck, Van, Coupe, Convertible, Wagon |
| `exterior_color` | Data | Exterior color |
| `interior_color` | Data | Interior color |
| `mileage_in` | Int | Mileage at acquisition |
| `mileage_current` | Int | Current mileage |
| `transmission` | Select | Automatic, Manual, CVT |
| `drivetrain` | Select | FWD, RWD, AWD, 4WD |
| `fuel_type` | Select | Gasoline, Diesel, Hybrid, Electric, Plug-in Hybrid |
| `engine` | Data | Engine description (e.g., 2.5L 4-Cyl) |
| `doors` | Int | Number of doors |
| `title_status` | Select | Clean, Salvage, Rebuilt, Lemon, Flood |
| `title_state` | Data | State of title |
| **Title & Lien** |||
| `title_number` | Data | Title document number |
| `title_copy` | Attach | Photocopy/scan of title |
| `title_received` | Check | Title has been received |
| `title_received_date` | Date | Date title was received |
| `title_location` | Select | In Office, With Lienholder, At DMV, Sent to Buyer, Sent to New Lienholder |
| `has_lien` | Check | Vehicle has existing lien |
| `lienholder` | Link → Lienholder | Current lienholder (select from list) |
| `lienholder_name` | Data | Lienholder name (if not in list) |
| `lienholder_account` | Data | Account number with lienholder |
| `lien_payoff_amount` | Currency | Payoff amount |
| `lien_payoff_good_through` | Date | Payoff quote valid until |
| `lien_paid_date` | Date | Date lien was paid off |
| `lien_release_received` | Check | Lien release document received |
| `lien_release_document` | Attach | Lien release letter/document |
| **Pricing** |||
| `asking_price` | Currency | Current asking/listing price |
| `floor_price` | Currency | Minimum acceptable price |
| `book_value` | Currency | Book/market value reference |
| **Dates** |||
| `acquisition_date` | Date | Date vehicle was acquired |
| `lot_date` | Date | Date vehicle arrived on lot (frontline ready) |
| `lot_expiration_date` | Date | Target date to move vehicle |
| `sale_date` | Date | Date sold (if applicable) |
| **Calculated Fields** |||
| `days_on_lot` | Int (read-only) | Calculated: today - lot_date |
| `total_investment` | Currency (read-only) | Acquisition cost + all expenses |
| `potential_profit` | Currency (read-only) | Asking price - total investment |
| **Links** |||
| `acquisition` | Link → Vehicle Acquisition | Acquisition details |
| `condition` | Link → Vehicle Condition | Condition report |
| `market_info` | Link → Vehicle Market Info | Market data |
| `sale` | Link → Vehicle Sale | Sale details (when sold) |
| **Child Tables** |||
| `photos` | Table → Vehicle Photo | Vehicle photos |
| `expenses` | Table → Vehicle Expense | All vehicle expenses |
| `listings` | Table → Vehicle Listing | Active/past listings |
| `notes` | Table → Vehicle Note | Notes and history |
| **Features** |||
| `features` | Text | Key features (comma-separated or small text) |
| `description` | Text Editor | Full vehicle description |

---

### 2. Vehicle Photo (Child Table of Vehicle)

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `photo` | Attach Image | Image file |
| `photo_type` | Select | Exterior, Interior, Engine, Damage, Document, Other |
| `caption` | Data | Description of photo |
| `is_primary` | Check | Primary/featured photo |
| `sequence` | Int | Display order |
| `taken_date` | Date | When photo was taken |

---

### 3. Vehicle Acquisition (Linked DocType)

Detailed acquisition/purchase information.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| **Source Info** |||
| `vehicle` | Link → Vehicle | Parent vehicle |
| `source_type` | Select | Auction, Trade-In, Private Purchase, Dealer Purchase, Repo |
| `source` | Link → Acquisition Source | Specific source (auction house, etc.) |
| `source_name` | Data | Source name if not in list |
| **Auction Details** |||
| `auction_name` | Data | Auction house name |
| `auction_location` | Data | Auction location |
| `auction_date` | Date | Date of auction |
| `lane_number` | Data | Lane/run number |
| `auction_id` | Data | Auction's ID for the vehicle |
| **Purchase Details** |||
| `purchase_date` | Date | Date of purchase |
| `seller_name` | Data | Seller name |
| `seller_contact` | Data | Seller phone/email |
| **Costs** |||
| `bid_amount` | Currency | Winning bid / purchase price |
| `buyer_fee` | Currency | Auction buyer fee |
| `transport_cost` | Currency | Transport/shipping cost |
| `title_fee` | Currency | Title transfer fees |
| `other_fees` | Currency | Any other acquisition fees |
| **Lien Payoff (at Acquisition)** |||
| `had_existing_lien` | Check | Vehicle had lien at purchase |
| `previous_lienholder` | Link → Lienholder | Previous lienholder (select from list) |
| `previous_lienholder_name` | Data | Lienholder name (if not in list) |
| `lien_payoff_amount` | Currency | Amount paid to clear lien |
| `lien_payoff_date` | Date | Date lien was paid off |
| `lien_payoff_confirmation` | Data | Confirmation/reference number |
| `total_acquisition_cost` | Currency (read-only) | Sum of all costs including lien payoff |
| **Turnover Expenses** (Initial Estimate) |||
| `estimated_recon` | Currency | Estimated reconditioning |
| `estimated_repairs` | Currency | Estimated repairs needed |
| `estimated_detail` | Currency | Estimated detail cost |
| `total_estimated_turnover` | Currency (read-only) | Sum of estimates |
| **Documents** |||
| `purchase_receipt` | Attach | Receipt/invoice |
| `title_image` | Attach | Title document |
| `notes` | Text | Acquisition notes |

---

### 4. Vehicle Expense (Child Table of Vehicle)

Individual expense line items for a vehicle.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `expense_date` | Date | Date of expense |
| `category` | Link → Expense Category | Expense category |
| `description` | Data | Description of work/expense |
| `vendor` | Data | Vendor/shop name |
| `amount` | Currency | Expense amount |
| `receipt` | Attach | Receipt image |
| `notes` | Small Text | Additional notes |
| `is_recon` | Check | Part of reconditioning (vs. repair) |

---

### 5. Vehicle Condition (Linked DocType)

Condition assessment and inspection details.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `vehicle` | Link → Vehicle | Parent vehicle |
| `inspection_date` | Date | Date of inspection |
| `inspected_by` | Data | Inspector name |
| **Condition Ratings** (1-5 scale) |||
| `exterior_rating` | Rating | Exterior condition |
| `interior_rating` | Rating | Interior condition |
| `mechanical_rating` | Rating | Mechanical condition |
| `tire_rating` | Rating | Tire condition |
| `overall_rating` | Rating (read-only) | Calculated average |
| **Details** |||
| `exterior_notes` | Text | Exterior condition details |
| `interior_notes` | Text | Interior condition details |
| `mechanical_notes` | Text | Mechanical issues/notes |
| `tire_details` | Data | Tire tread depth, brand, etc. |
| **Damage** |||
| `has_damage` | Check | Vehicle has damage |
| `damage_description` | Text | Description of damage |
| `damage_photos` | Attach | Photos of damage |
| **Inspection Items** |||
| `ac_works` | Check | A/C functional |
| `heat_works` | Check | Heat functional |
| `all_power_windows` | Check | All power windows work |
| `all_power_locks` | Check | All power locks work |
| `radio_works` | Check | Radio/infotainment works |
| `backup_camera` | Check | Backup camera works |
| `check_engine_light` | Check | Check engine light on |
| `other_warning_lights` | Data | Other warning lights |
| `smog_status` | Select | Passed, Failed, Exempt, Pending |
| **Service History** |||
| `service_records_available` | Check | Has service records |
| `carfax_report` | Attach | Carfax/history report |
| `maintenance_notes` | Text | Known maintenance history |

---

### 6. Vehicle Market Info (Linked DocType)

Market pricing data and comparables.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `vehicle` | Link → Vehicle | Parent vehicle |
| `info_date` | Date | Date info was gathered |
| **Market Values** |||
| `retail_value` | Currency | Retail market value |
| `wholesale_value` | Currency | Wholesale value |
| `trade_in_value` | Currency | Trade-in value |
| `private_party_value` | Currency | Private party value |
| `auction_value` | Currency | Expected auction value |
| **Data Sources** |||
| `kbb_value` | Currency | Kelley Blue Book value |
| `nada_value` | Currency | NADA value |
| `blackbook_value` | Currency | Black Book value |
| `mmr_value` | Currency | Manheim Market Report |
| **Comparables** |||
| `comp_1_link` | Data | URL to comparable listing 1 |
| `comp_1_price` | Currency | Comp 1 price |
| `comp_1_notes` | Data | Comp 1 details (mileage, etc.) |
| `comp_2_link` | Data | URL to comparable listing 2 |
| `comp_2_price` | Currency | Comp 2 price |
| `comp_2_notes` | Data | Comp 2 details |
| `comp_3_link` | Data | URL to comparable listing 3 |
| `comp_3_price` | Currency | Comp 3 price |
| `comp_3_notes` | Data | Comp 3 details |
| **Market Analysis** |||
| `market_trend` | Select | Rising, Stable, Declining |
| `days_to_sell_estimate` | Int | Estimated days to sell |
| `recommended_price` | Currency | Recommended listing price |
| `notes` | Text | Market analysis notes |

---

### 7. Vehicle Listing (Child Table of Vehicle)

Tracks where vehicle is listed for sale.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `platform` | Link → Listing Platform | Listing platform |
| `listing_url` | Data (URL) | Direct link to listing |
| `listing_id` | Data | Platform's listing ID |
| `listed_date` | Date | Date listed |
| `listed_price` | Currency | Price on this listing |
| `status` | Select | Active, Paused, Expired, Removed |
| `expires_date` | Date | Listing expiration date |
| `views` | Int | Number of views (if tracked) |
| `inquiries` | Int | Number of inquiries |
| `last_updated` | Date | Last time listing was updated |
| `notes` | Small Text | Notes about this listing |

---

### 8. Vehicle Sale (Linked DocType)

Sale transaction details.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `vehicle` | Link → Vehicle | Vehicle sold |
| `sale_date` | Date | Date of sale |
| `sale_type` | Select | Retail, Wholesale, Trade, Auction |
| **Buyer Info** |||
| `buyer_name` | Data | Buyer name |
| `buyer_phone` | Data | Buyer phone |
| `buyer_email` | Data | Buyer email |
| `buyer_address` | Text | Buyer address |
| `lead` | Link → Lead | Associated lead (if applicable) |
| **Pricing** |||
| `sale_price` | Currency | Final sale price |
| `trade_in_vehicle` | Data | Trade-in VIN (if any) |
| `trade_in_allowance` | Currency | Trade-in value given |
| `down_payment` | Currency | Down payment amount |
| `amount_financed` | Currency | Amount financed |
| **Fees & Taxes** |||
| `doc_fee` | Currency | Documentation fee |
| `registration_fee` | Currency | Registration fee |
| `sales_tax` | Currency | Sales tax collected |
| `other_fees` | Currency | Other fees |
| `total_deal_amount` | Currency (read-only) | Total deal value |
| **Financing** |||
| `payment_method` | Select | Cash, Dealer Financing, Outside Financing, BHPH |
| `finance_company` | Data | Finance company/bank name |
| `finance_reserve` | Currency | Finance reserve earned |
| `interest_rate` | Float | Interest rate |
| `term_months` | Int | Loan term in months |
| `monthly_payment` | Currency | Monthly payment amount |
| **New Lienholder (Buyer's Financing)** |||
| `new_lienholder` | Link → Lienholder | New lienholder (select from list) |
| `new_lienholder_name` | Data | Lienholder name (if not in list) |
| `new_lienholder_account` | Data | Buyer's loan/account number |
| `title_sent_to_lienholder` | Check | Title sent to new lienholder |
| `title_sent_date` | Date | Date title was sent |
| `title_tracking` | Data | Tracking number if mailed |
| **Profitability** |||
| `gross_profit` | Currency (read-only) | Sale price - total investment |
| `net_profit` | Currency (read-only) | Gross - sale expenses |
| `profit_margin` | Percent (read-only) | Profit percentage |
| **Documents** |||
| `bill_of_sale` | Attach | Bill of sale document |
| `buyer_agreement` | Attach | Buyer agreement |
| `notes` | Text | Sale notes |

---

### 9. Lead (Master DocType)

Potential buyers / sales leads.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `lead_id` | Data | Auto-generated ID |
| `status` | Select | New, Contacted, Appointment Set, Showed, Negotiating, Sold, Lost |
| **Contact Info** |||
| `first_name` | Data | First name |
| `last_name` | Data | Last name |
| `phone` | Data | Primary phone |
| `alt_phone` | Data | Alternate phone |
| `email` | Data | Email address |
| `preferred_contact` | Select | Phone, Text, Email |
| `best_time_to_contact` | Data | Best time to reach |
| **Source** |||
| `source` | Select | Website, Facebook, Craigslist, Referral, Walk-in, Phone Call, Other |
| `source_detail` | Data | Specific source details |
| `listing_platform` | Link → Listing Platform | Which platform (if applicable) |
| `original_vehicle` | Link → Vehicle | Vehicle they inquired about |
| **Qualification** |||
| `budget_min` | Currency | Minimum budget |
| `budget_max` | Currency | Maximum budget |
| `has_trade` | Check | Has trade-in |
| `trade_description` | Data | Trade-in vehicle description |
| `financing_needed` | Check | Needs financing |
| `credit_situation` | Select | Excellent, Good, Fair, Poor, Unknown |
| `timeline` | Select | Immediate, This Week, This Month, Just Looking |
| **Preferences** |||
| `preferred_makes` | Data | Preferred makes |
| `preferred_body_style` | Data | Preferred body styles |
| `must_have_features` | Text | Required features |
| **Follow-up** |||
| `next_follow_up` | Date | Next follow-up date |
| `follow_up_notes` | Text | Notes for follow-up |
| `assigned_to` | Link → User | Assigned salesperson |
| **Child Tables** |||
| `vehicle_interests` | Table → Lead Vehicle Interest | Vehicles of interest |
| `activities` | Table → Lead Activity | Activity log |
| **Outcome** |||
| `lost_reason` | Select | Price, Financing, Found Elsewhere, No Response, Other |
| `lost_notes` | Text | Details on lost lead |
| `converted_sale` | Link → Vehicle Sale | Resulting sale |

---

### 10. Lead Vehicle Interest (Child Table of Lead)

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `vehicle` | Link → Vehicle | Vehicle of interest |
| `interest_level` | Select | High, Medium, Low |
| `notes` | Data | Notes about interest |
| `test_drive` | Check | Requested/completed test drive |
| `test_drive_date` | Date | Test drive date |

---

### 11. Lead Activity (Child Table of Lead)

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `activity_date` | Datetime | Date/time of activity |
| `activity_type` | Select | Call, Text, Email, Visit, Test Drive, Offer Made, Other |
| `direction` | Select | Inbound, Outbound |
| `notes` | Text | Activity details |
| `next_step` | Data | Planned next step |
| `logged_by` | Link → User | Who logged the activity |

---

### 12. Company Expense (Master DocType)

Non-vehicle-specific business expenses.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `expense_id` | Data | Auto-generated ID |
| `expense_date` | Date | Date of expense |
| `category` | Link → Expense Category | Expense category |
| `description` | Data | Description |
| `amount` | Currency | Amount |
| `vendor` | Data | Vendor/payee |
| `payment_method` | Select | Cash, Check, Card, ACH |
| `reference_number` | Data | Check number, transaction ID |
| `is_recurring` | Check | Recurring expense |
| `recurrence` | Select | Weekly, Monthly, Quarterly, Annual |
| `receipt` | Attach | Receipt image |
| `notes` | Text | Additional notes |

---

### 13. Expense Category (Master DocType)

Categories for both vehicle and company expenses.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `category_name` | Data | Category name |
| `expense_type` | Select | Vehicle, Company, Both |
| `parent_category` | Link → Expense Category | Parent category (for hierarchy) |
| `description` | Data | Description |
| `is_active` | Check | Active/inactive |

**Default Categories:**

Vehicle:
- Reconditioning
  - Detail
  - Paint/Body
  - Mechanical Repair
  - Tires
  - Glass
  - Upholstery
- Inspection/Smog
- Transport
- Registration/Title
- Storage
- Photography

Company:
- Rent/Lease
- Utilities
- Insurance
- Payroll
- Marketing/Advertising
- Software/Subscriptions
- Professional Services
- Office Supplies
- Licenses/Permits
- Miscellaneous

---

### 14. Listing Platform (Master DocType)

Platforms where vehicles are listed.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `platform_name` | Data | Platform name |
| `platform_url` | Data | Platform website |
| `platform_type` | Select | Marketplace, Social, Classified, Auction, Dealer Site |
| `cost_type` | Select | Free, Per Listing, Subscription |
| `cost_amount` | Currency | Cost per listing or subscription |
| `login_url` | Data | Login/posting URL |
| `notes` | Text | Notes, tips for platform |
| `is_active` | Check | Currently using this platform |

**Common Platforms:**
- Facebook Marketplace
- Craigslist
- CarGurus
- Cars.com
- Autotrader
- OfferUp
- Dealer Website
- eBay Motors

---

### 15. Lienholder (Master DocType)

Banks, credit unions, and finance companies for lien tracking.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `lienholder_name` | Data | Company/bank name |
| `lienholder_type` | Select | Bank, Credit Union, Finance Company, BHPH, Other |
| `address_line_1` | Data | Street address |
| `address_line_2` | Data | Suite/unit |
| `city` | Data | City |
| `state` | Data | State |
| `zip_code` | Data | ZIP code |
| `phone` | Data | Main phone number |
| `fax` | Data | Fax number (for title work) |
| `payoff_phone` | Data | Payoff department phone |
| `title_department_address` | Text | Address for sending titles (if different) |
| `website` | Data | Website URL |
| `notes` | Text | Notes about working with this lienholder |
| `is_active` | Check | Active/commonly used |

**Common Lienholders:**
- Chase Auto
- Capital One Auto
- Ally Financial
- Wells Fargo Auto
- Bank of America
- Local credit unions
- Westlake Financial
- Credit Acceptance

---

### 16. Acquisition Source (Master DocType)

Sources for acquiring vehicles.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `source_name` | Data | Source name |
| `source_type` | Select | Auction, Wholesaler, Trade Network, Private |
| `location` | Data | Location/address |
| `contact_name` | Data | Primary contact |
| `contact_phone` | Data | Contact phone |
| `contact_email` | Data | Contact email |
| `website` | Data | Website URL |
| `dealer_number` | Data | Your dealer/buyer number |
| `notes` | Text | Notes about this source |
| `is_active` | Check | Active source |

---

## Calculated Fields & Logic

### Days on Lot Calculation
```python
# In Vehicle DocType
def before_save(self):
    if self.lot_date:
        self.days_on_lot = date_diff(today(), self.lot_date)
```

### Total Investment Calculation
```python
# In Vehicle DocType
def calculate_total_investment(self):
    acquisition_cost = 0
    if self.acquisition:
        acq = frappe.get_doc("Vehicle Acquisition", self.acquisition)
        acquisition_cost = acq.total_acquisition_cost or 0
    
    expense_total = sum([e.amount for e in self.expenses])
    
    self.total_investment = acquisition_cost + expense_total
```

### Profit Calculations
```python
# In Vehicle Sale DocType
def calculate_profits(self):
    vehicle = frappe.get_doc("Vehicle", self.vehicle)
    self.gross_profit = self.sale_price - vehicle.total_investment
    self.profit_margin = (self.gross_profit / vehicle.total_investment) * 100
```

---

## Reports & Dashboards

### Key Reports

1. **Inventory Aging Report**
   - Vehicles grouped by days on lot (0-30, 31-60, 61-90, 90+)
   - Flags vehicles approaching lot expiration

2. **Profitability Report**
   - Profit per vehicle sold
   - Average profit margin
   - ROI by acquisition source

3. **Expense Summary**
   - Vehicle expenses by category
   - Company expenses by category
   - Month-over-month comparison

4. **Lead Pipeline**
   - Leads by status
   - Conversion rate
   - Lead source performance

5. **Listing Performance**
   - Views and inquiries by platform
   - Cost per lead by platform

### Dashboard Metrics

- Total inventory count
- Total inventory value
- Average days on lot
- Units sold (MTD/YTD)
- Gross profit (MTD/YTD)
- Active leads
- Appointments this week

---

## Workflow Suggestions

### Vehicle Workflow States
1. **Acquired** → Initial entry
2. **In Recon** → Being prepared
3. **Photo Ready** → Needs photos
4. **Frontline** → On lot, available
5. **Pending Sale** → Deal in progress
6. **Sold** → Completed sale

### Lead Workflow
1. **New** → Just received
2. **Contacted** → Initial contact made
3. **Qualified** → Confirmed buyer
4. **Appointment** → Scheduled to visit
5. **Negotiating** → Working deal
6. **Won/Lost** → Final outcome

---

## Integration Points

- **VIN Decoder API** - Auto-populate vehicle details
- **Market Value APIs** - KBB, NADA, Black Book
- **Listing Syndication** - Push to multiple platforms
- **Accounting** - Sync with ERPNext GL
- **CRM** - Lead management enhancement

---

## Notes

- All currency fields should use the company's default currency
- Photo storage should consider using ERPNext's file manager with compression
- Consider adding barcode/QR code generation for stock numbers
- Mobile-friendly forms for lot condition inspections
