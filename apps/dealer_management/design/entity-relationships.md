# Entity Relationship Diagram

## Visual Representation

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    VEHICLE (Master)                                  │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│  vehicle_id | vin | stock_number | status                                           │
│  year | make | model | trim | body_style                                            │
│  exterior_color | interior_color | mileage_in | mileage_current                     │
│  transmission | drivetrain | fuel_type | engine                                     │
│  title_status | asking_price | floor_price | book_value                             │
│  acquisition_date | lot_date | lot_expiration_date | sale_date                      │
│  days_on_lot (calc) | total_investment (calc) | potential_profit (calc)             │
└─────────────────────────────────────────────────────────────────────────────────────┘
        │                    │                    │                    │
        │ 1:N                │ 1:N                │ 1:N                │ 1:N
        ▼                    ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│Vehicle Photo │    │Vehicle Expense│   │Vehicle Listing│   │ Vehicle Note │
│ (Child)      │    │ (Child)       │   │ (Child)       │   │ (Child)      │
├──────────────┤    ├──────────────┤    ├──────────────┤    ├──────────────┤
│photo         │    │expense_date  │    │platform ──────┼───┼─► Listing    │
│photo_type    │    │category ─────┼────┼─► Expense    │    │   Platform  │
│caption       │    │description   │    │   Category   │    │listing_url  │
│is_primary    │    │vendor        │    │listing_id    │    │listed_date  │
│sequence      │    │amount        │    │listed_date   │    │status       │
└──────────────┘    │receipt       │    │listed_price  │    │views        │
                    └──────────────┘    │status        │    └──────────────┘
                                        └──────────────┘
        │
        │ 1:1 Links
        ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                              LINKED DOCUMENTS                                      │
└───────────────────────────────────────────────────────────────────────────────────┘
        │                    │                    │                    │
        ▼                    ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Vehicle     │    │   Vehicle    │    │   Vehicle    │    │   Vehicle    │
│ Acquisition  │    │  Condition   │    │ Market Info  │    │    Sale      │
├──────────────┤    ├──────────────┤    ├──────────────┤    ├──────────────┤
│source_type   │    │inspect_date  │    │info_date     │    │sale_date     │
│source ───────┼────┼─► Acquisition│    │retail_value  │    │sale_type     │
│   Source     │    │   inspected_by    │wholesale_val │    │buyer_name    │
│auction_name  │    │exterior_rating    │trade_in_value│    │sale_price    │
│purchase_date │    │interior_rating    │kbb_value     │    │trade_in_allow│
│bid_amount    │    │mechanical_rating  │nada_value    │    │down_payment  │
│buyer_fee     │    │tire_rating   │    │comp_1_link   │    │payment_method│
│transport_cost│    │damage_desc   │    │comp_1_price  │    │gross_profit  │
│title_fee     │    │ac_works      │    │market_trend  │    │net_profit    │
│total_acq_cost│    │check_engine  │    │days_to_sell  │    │lead ─────────┼─┐
└──────────────┘    │carfax_report │    │recommended   │    └──────────────┘ │
                    └──────────────┘    └──────────────┘                     │
                                                                             │
┌────────────────────────────────────────────────────────────────────────────┼───────┐
│                                    LEAD (Master)                           │       │
│  ──────────────────────────────────────────────────────────────────────────┼─────  │
│  lead_id | status | first_name | last_name | phone | email          ◄──────┘       │
│  source | source_detail | original_vehicle (Link to Vehicle)                       │
│  budget_min | budget_max | financing_needed | credit_situation                     │
│  next_follow_up | assigned_to | lost_reason | converted_sale                       │
└────────────────────────────────────────────────────────────────────────────────────┘
        │                              │
        │ 1:N                          │ 1:N
        ▼                              ▼
┌─────────────────────┐       ┌─────────────────────┐
│ Lead Vehicle        │       │ Lead Activity       │
│ Interest (Child)    │       │ (Child)             │
├─────────────────────┤       ├─────────────────────┤
│vehicle (Link) ──────┼───────┼─► Vehicle           │
│interest_level       │       │activity_date        │
│test_drive           │       │activity_type        │
│test_drive_date      │       │direction            │
│notes                │       │notes                │
└─────────────────────┘       │logged_by            │
                              └─────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────┐
│                            COMPANY EXPENSE (Master)                                │
│  ────────────────────────────────────────────────────────────────────────────────  │
│  expense_id | expense_date | category (Link) | description                         │
│  amount | vendor | payment_method | is_recurring | recurrence                      │
└────────────────────────────────────────────────────────────────────────────────────┘
        │
        │ N:1
        ▼
┌─────────────────────┐
│ Expense Category    │
│ (Master)            │
├─────────────────────┤
│category_name        │
│expense_type         │
│parent_category      │◄──┐ (self-referential
│description          │───┘  for hierarchy)
│is_active            │
└─────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│ Listing Platform    │       │ Acquisition Source  │       │ Lienholder          │
│ (Master)            │       │ (Master)            │       │ (Master)            │
├─────────────────────┤       ├─────────────────────┤       ├─────────────────────┤
│platform_name        │       │source_name          │       │lienholder_name      │
│platform_url         │       │source_type          │       │lienholder_type      │
│platform_type        │       │location             │       │address, city, state │
│cost_type            │       │contact_name         │       │phone, fax           │
│cost_amount          │       │contact_phone        │       │payoff_phone         │
│is_active            │       │dealer_number        │       │title_dept_address   │
└─────────────────────┘       └─────────────────────┘       └─────────────────────┘
                                                                     ▲
                                    ┌────────────────────────────────┤
                                    │                                │
                              ┌─────┴─────┐                    ┌─────┴─────┐
                              │  Vehicle  │                    │  Vehicle  │
                              │(has_lien) │                    │   Sale    │
                              │lienholder │                    │new_lien-  │
                              └───────────┘                    │holder     │
                                                               └───────────┘
```

## Relationship Summary

| Parent | Child/Link | Relationship | Type |
|--------|------------|--------------|------|
| Vehicle | Vehicle Photo | 1:N | Child Table |
| Vehicle | Vehicle Expense | 1:N | Child Table |
| Vehicle | Vehicle Listing | 1:N | Child Table |
| Vehicle | Vehicle Note | 1:N | Child Table |
| Vehicle | Vehicle Acquisition | 1:1 | Link Field |
| Vehicle | Vehicle Condition | 1:1 | Link Field |
| Vehicle | Vehicle Market Info | 1:1 | Link Field |
| Vehicle | Vehicle Sale | 1:1 | Link Field |
| Lead | Lead Vehicle Interest | 1:N | Child Table |
| Lead | Lead Activity | 1:N | Child Table |
| Lead | Vehicle (original inquiry) | N:1 | Link Field |
| Vehicle Sale | Lead | N:1 | Link Field |
| Vehicle Expense | Expense Category | N:1 | Link Field |
| Company Expense | Expense Category | N:1 | Link Field |
| Vehicle Listing | Listing Platform | N:1 | Link Field |
| Vehicle Acquisition | Acquisition Source | N:1 | Link Field |
| Vehicle | Lienholder | N:1 | Link Field (current lien) |
| Vehicle Acquisition | Lienholder | N:1 | Link Field (previous lien) |
| Vehicle Sale | Lienholder | N:1 | Link Field (new lien) |
| Expense Category | Expense Category (parent) | N:1 | Self-referential |

## Data Flow

```
                    ACQUISITION FLOW
                    ================
                    
    [Auction/Source] ──► [Vehicle Created] ──► [Acquisition Doc]
                              │
                              ▼
                    [Condition Assessment]
                              │
                              ▼
                    [Add Expenses/Recon]
                              │
                              ▼
                    [Market Info Added]
                              │
                              ▼
                    [Photos Uploaded]
                              │
                              ▼
                    [Listings Created]


                    SALES FLOW
                    ==========
                    
    [Lead Inquiry] ──► [Lead Created] ──► [Activity Logged]
          │                   │
          │                   ▼
          │           [Vehicle Interest Added]
          │                   │
          │                   ▼
          │           [Test Drive/Negotiation]
          │                   │
          └───────────────────┼───────────────────┐
                              ▼                   │
                    [Vehicle Sale Created] ◄──────┘
                              │
                              ▼
                    [Vehicle Status → Sold]
                              │
                              ▼
                    [Lead Status → Won]


                    REPORTING FLOW
                    ==============
                    
    [Vehicles] ────┬──► Inventory Aging Report
                   ├──► Profitability Report
                   └──► Days on Lot Analysis
                   
    [Expenses] ────┬──► Vehicle Cost Analysis
                   └──► Company P&L
                   
    [Leads] ───────┬──► Pipeline Report
                   └──► Source Performance
                   
    [Sales] ───────┬──► Sales Performance
                   └──► Profit Analysis
```

## Key Business Rules

1. **VIN Uniqueness**: VIN must be unique across all vehicles
2. **Status Transitions**: Vehicle status follows workflow (Acquired → Recon → Frontline → Pending → Sold)
3. **Days on Lot**: Auto-calculated from lot_date, updates daily
4. **Total Investment**: Sum of acquisition cost + all vehicle expenses (including lien payoff)
5. **Profit Calculation**: Sale price - total investment
6. **Lead Conversion**: When sale created, update lead status to Won
7. **Expense Categorization**: Categories apply to both vehicle and company expenses
8. **Listing Tracking**: Multiple active listings per vehicle allowed
9. **Title Tracking**: Title location must be updated when status changes (sold → sent to buyer/lienholder)
10. **Lien Status**: Cannot mark vehicle "Available" until title_received = true OR lien status is cleared
11. **Lien Payoff**: If vehicle has lien at acquisition, payoff amount added to total acquisition cost
