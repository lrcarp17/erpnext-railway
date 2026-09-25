# Dealer Management

A comprehensive ERPNext application for independent auto dealers to manage vehicle inventory, acquisitions, sales leads, listings, and expenses.

## Features

- **Vehicle Inventory Management**: Track vehicles from acquisition through sale
- **Acquisition Tracking**: Record vehicle purchases from auctions, trade-ins, and private sales
- **Lead Management**: Manage sales leads and customer interactions
- **Multi-Platform Listings**: Track vehicle listings across multiple platforms
- **Expense Tracking**: Manage both vehicle-specific and company-wide expenses
- **Lienholder Management**: Store information for common lienholders and finance companies
- **Document Import**: Upload a title, bill of sale, listing, or auction report and have the vehicle updated (matched by VIN) or created from it

## Installation

### Prerequisites

- ERPNext v14 or later
- Frappe Bench

### Install the App

```bash
# Navigate to your bench directory
cd ~/frappe-bench

# Get the app from repository
bench get-app https://github.com/lrcarp17/Dealerbase

# Install on your site
bench --site [site-name] install-app dealer_management

# Run migrations
bench --site [site-name] migrate
```

## DocTypes

### Core DocTypes

| DocType | Description | Auto-naming |
|---------|-------------|-------------|
| **Dealer Vehicle** | Main vehicle inventory record | VH-.YYYY.-.##### |
| **Dealer Lead** | Sales leads and customer contacts | LD-.YYYY.-.##### |
| **Vehicle Sale** | Completed vehicle sales transactions | - |
| **Vehicle Acquisition** | Vehicle purchase/acquisition records | - |
| **Company Expense** | Company-wide expenses | EXP-.YYYY.-.MM.-.##### |

### Supporting DocTypes

| DocType | Description |
|---------|-------------|
| **Expense Category** | Categories for organizing expenses (Vehicle/Company) |
| **Listing Platform** | Platforms where vehicles are listed for sale |
| **Lienholder** | Banks and finance companies for payoffs |
| **Acquisition Source** | Sources where vehicles are acquired |

## Default Data (Fixtures)

The app comes pre-loaded with common default data:

### Expense Categories
- **Vehicle Expenses**: Reconditioning (Detail, Paint/Body, Mechanical, Tires, Glass, Upholstery), Inspection/Smog, Transport, Registration/Title, Storage, Photography
- **Company Expenses**: Rent/Lease, Utilities, Insurance, Payroll, Marketing/Advertising, Software/Subscriptions, Professional Services, Office Supplies, Licenses/Permits
- **Both**: Miscellaneous

### Listing Platforms
- Facebook Marketplace
- Craigslist
- CarGurus
- Cars.com
- Autotrader
- OfferUp
- eBay Motors
- Dealer Website

### Lienholders
Pre-configured with major auto finance companies:
- Chase Auto Finance
- Capital One Auto Finance
- Ally Financial
- Wells Fargo Auto
- Bank of America
- Westlake Financial
- Credit Acceptance
- CarMax Auto Finance
- Toyota Financial Services
- Honda Financial Services
- Ford Motor Credit

### Acquisition Sources
- Manheim
- ADESA
- Copart
- IAA
- ACV Auctions
- CarMax Wholesale
- Trade-In
- Private Purchase

## Configuration

### After Installation

1. **Review Default Data**: Navigate to each setup DocType to review and customize the pre-loaded data
2. **Add Your Lienholders**: Add any additional lienholders you work with regularly
3. **Configure Expense Categories**: Add or modify expense categories to match your accounting needs
4. **Set Up Listing Platforms**: Configure the platforms where you list vehicles

### Workspace

Access the Dealer Management workspace from the sidebar for quick access to:
- Add/View Vehicles
- Add/View Leads
- Acquisition management
- Expense tracking
- Setup and configuration

## Usage

### Adding a Vehicle

1. Go to Dealer Management > Inventory > Dealer Vehicle
2. Click "Add Vehicle"
3. Enter vehicle details (VIN, Year, Make, Model, etc.)
4. The system will auto-generate a Vehicle ID (e.g., VH-2024-00001)

### Recording an Acquisition

1. Create a Dealer Vehicle record first
2. Go to Acquisition > Vehicle Acquisition
3. Link to the vehicle and enter acquisition details
4. Select the acquisition source

### Managing Leads

1. Go to Sales > Dealer Lead
2. Add new leads with contact information
3. Link leads to vehicles they're interested in
4. Track follow-ups and status

### Tracking Expenses

- **Vehicle Expenses**: Add expenses directly from the Vehicle record
- **Company Expenses**: Go to Expenses > Company Expense

## Document Import

Upload a **title**, **bill of sale**, **listing**, or **auction condition report** (PDF, photo, scan, or screenshot) and the app reads it with Claude, matches the VIN to an existing Dealer Vehicle, and shows every proposed change for review before saving.

- **Dealer Vehicle list → Import from Document**: updates the vehicle with the document's VIN, or creates a new one.
- **Dealer Vehicle form → Update from Document**: same, starting from a vehicle (warns if the VIN doesn't match).

What each document fills in:

| Document | Vehicle fields | Also |
|----------|----------------|------|
| Title | VIN, year/make/model/trim, specs, mileage, title status/state/number, lienholder, title received | Attached as the vehicle's Title Copy |
| Bill of Sale | VIN, year/make/model, specs, mileage | Optionally creates a draft Vehicle Sale (buyer, price, date) or a Vehicle Acquisition (seller, price, date) |
| Listing | VIN, specs, mileage, asking price, features, description | Adds or updates a row in the vehicle's Listings table |
| Auction listing / condition report (Manheim, ADESA, ACV, ...) | VIN, specs, mileage, packages/options as features | Optionally adds a note (auction, lane/run, seller, grade, announcements, history), a Vehicle Market Info record with the MMR, and a Vehicle Condition record with the damage, interior/mechanical notes, and tires |

In the review dialog, each field shows the current value next to the value read from the document; untick anything you don't want applied or edit the value first. The uploaded file is attached to the vehicle.

**Setup:** open **AI Settings** and enter your Anthropic API key. If your API key is organization-scoped rather than workspace-scoped, also add your Workspace ID (found in the Anthropic Console under Settings → Workspaces). The model defaults to `claude-opus-5`. The server needs outbound access to `api.anthropic.com`.

Alternatively, set credentials via `site_config.json` (`anthropic_api_key`, `anthropic_workspace_id`, `anthropic_model`) or environment variables (`ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_MODEL`).

## Reports

- **Vehicle Listing Report**: Overview of active listings across platforms
- **Vehicle Expense Report**: Detailed expense breakdown by vehicle

## Support

For issues, feature requests, or contributions, please open an issue in the repository.

## License

MIT License

## Naming Note

The vehicle and lead DocTypes are named **Dealer Vehicle** and **Dealer Lead** because ERPNext already ships DocTypes called `Vehicle` and `Lead`. Using the same names would clash with ERPNext's own records when the app is installed.
