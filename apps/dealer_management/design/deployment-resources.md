# ERPNext Deployment Resources

## Recommended: Frappe Cloud (Private Bench)

**Sign Up:** [frappecloud.com](https://frappecloud.com)

Frappe Cloud is the official managed hosting from the creators of ERPNext. Private Bench tier supports custom apps like `dealer_management`.

### Why Frappe Cloud?

| Feature | Benefit |
|---------|---------|
| **Official Support** | Direct from ERPNext creators |
| **Custom Apps** | Install `dealer_management` from GitHub |
| **Zero DevOps** | No server management, security patches, or upgrades |
| **Auto Backups** | Daily automated + offsite backups |
| **Auto Upgrades** | One-click version upgrades with rollback |
| **SSH Access** | Full access when you need it |
| **Staging Environments** | Test changes before production |
| **Monitoring** | CPU, memory, disk alerts built-in |

### Pricing (2026)

| Plan | Cost | Best For |
|------|------|----------|
| **Shared Site** | $5-25/mo | Evaluation only (no custom apps) |
| **Private Bench** | $25-50/mo | ✅ Small dealers with custom apps |
| **Dedicated Server** | $100-500/mo | Larger operations, multi-site |

For `dealer_management`, you need **Private Bench** ($25/mo minimum).

---

## Step-by-Step: Frappe Cloud Setup

### Step 1: Create Account

1. Go to [frappecloud.com](https://frappecloud.com)
2. Sign up with email or GitHub
3. Verify your email

### Step 2: Create a Private Bench

1. Click **"New Bench"** from dashboard
2. Select **"Private Bench"** (required for custom apps)
3. Choose settings:
   - **Region**: Pick closest to your location
   - **ERPNext Version**: v16 (latest stable)
   - **Plan**: Start with smallest, upgrade later if needed

### Step 3: Add the Dealer Management App

1. In your bench, go to **Apps** tab
2. Click **"Add App"**
3. Select **"Add from GitHub"**
4. Enter repository URL:
   ```
   https://github.com/lrcarp17/Dealerbase
   ```
5. Branch: `main` (or `cursor/dealer-management-app-a970`)
6. Click **"Add App"**
7. Wait for the app to be fetched and validated

### Step 4: Create Your Site

1. Go to **Sites** tab
2. Click **"New Site"**
3. Configure:
   - **Subdomain**: `yourdealer` (becomes `yourdealer.frappe.cloud`)
   - **Apps to Install**: 
     - ✅ ERPNext
     - ✅ dealer_management
   - **Admin Password**: Set a strong password
4. Click **"Create Site"**
5. Wait 2-5 minutes for site creation

### Step 5: Initial ERPNext Setup

1. Access your site: `https://yourdealer.frappe.cloud`
2. Login as `Administrator` with your password
3. Complete the Setup Wizard:
   - **Country**: Your country
   - **Language**: English
   - **Timezone**: Your timezone
   - **Currency**: USD (or your currency)
   - **Company Name**: Your dealership name
   - **Company Abbreviation**: e.g., "ABC"
   - **Fiscal Year**: Your fiscal year start
   - **Chart of Accounts**: Standard (or your country's)
4. Click **"Complete Setup"**

### Step 6: Access Dealer Management

1. After setup, click the search bar (or press `/`)
2. Search for **"Dealer Management"**
3. Click to open the workspace
4. You'll see:
   - Shortcuts: Add Vehicle, Vehicle List, Add Lead, Lead List
   - Links to all DocTypes organized by category

### Step 7: Load Default Data (Automatic)

The fixtures are loaded automatically during installation:
- ✅ 22 Expense Categories
- ✅ 8 Listing Platforms  
- ✅ 11 Lienholders
- ✅ 8 Acquisition Sources

Verify by going to **Dealer Management → Setup → Expense Category** (should see pre-loaded data).

---

## Frappe Cloud: Custom Domain Setup

### Add Your Domain

1. Go to your site in Frappe Cloud dashboard
2. Click **Settings** → **Domains**
3. Click **"Add Domain"**
4. Enter your domain: `erp.yourdealership.com`

### Configure DNS

Add these DNS records at your domain registrar:

| Type | Name | Value |
|------|------|-------|
| CNAME | erp | `yoursite.frappe.cloud` |

Or for apex domain:
| Type | Name | Value |
|------|------|-------|
| A | @ | (IP provided by Frappe Cloud) |

### Enable SSL

SSL is automatically provisioned via Let's Encrypt once DNS propagates (usually 5-30 minutes).

---

## Frappe Cloud: Backup & Restore

### Automatic Backups
- **Frequency**: Daily
- **Retention**: Based on your plan
- **Includes**: Database + files + site config
- **Offsite**: Yes, stored separately from your server

### Manual Backup
1. Go to site dashboard
2. Click **Backups** tab
3. Click **"Create Backup"**
4. Download when ready

### Restore from Backup
1. Go to **Backups** tab
2. Find the backup you want
3. Click **"Restore"**
4. Confirm (this overwrites current data)

---

## Frappe Cloud: Upgrades

### Minor Updates (v16.1 → v16.2)
1. Go to bench dashboard
2. You'll see "Update Available" notification
3. Click **"Update"**
4. Frappe Cloud handles migration automatically

### Major Upgrades (v16 → v17)
1. **Recommended**: Test on staging site first
2. Go to bench settings
3. Change version branch
4. Deploy and migrate

### Rollback
If an upgrade fails:
1. Go to **Deployments** tab
2. Find previous successful deployment
3. Click **"Rollback"**

---

## Frappe Cloud: SSH Access

For advanced debugging or custom scripts:

```bash
# Get SSH command from Frappe Cloud dashboard
# Sites → Your Site → Actions → SSH Access

ssh frappe@yoursite.frappe.cloud

# Once connected:
cd frappe-bench
bench --site yoursite.frappe.cloud console
```

---

## Frappe Cloud: Monitoring

Built-in monitoring includes:
- CPU usage graphs
- Memory usage
- Disk space
- Request logs
- Error logs
- Background job status

Access via **Site Dashboard → Analytics**

---

## Alternative: Railway Deployment

**One-Click Deploy:** [ERPNext 16 on Railway](https://railway.com/deploy/erpnext-16-open-source-erp-with-nightly-backups--erpnext-16)

### What's Included

Railway's ERPNext template provides a complete production stack:

| Component | Details |
|-----------|---------|
| **ERPNext** | v16 with full Frappe framework |
| **MariaDB** | 11.8 (private network, secure) |
| **Backups** | Nightly automated to Railway bucket |
| **Services** | nginx, gunicorn, socket.io, workers, scheduler, Redis |

### Key Features

- **Secure by default** - Generated admin password, no public DB access, sign-up disabled
- **Nightly backups** - Database + files backed up at 03:00 UTC (7-day rolling)
- **Auto-migrations** - Version upgrades run `bench migrate` automatically
- **Real-time updates** - Socket.io for live notifications, progress bars

### Resource Requirements

| Component | Memory |
|-----------|--------|
| ERPNext | ~400 MB |
| MariaDB | ~250 MB |
| **Minimum Total** | 512 MB |

For small dealers, the base configuration (1 web worker, 1 background worker) should be sufficient.

### Initial Setup

1. Deploy via Railway template
2. Wait 1-2 minutes for first boot site creation
3. Access your Railway domain
4. Login as `Administrator` with password from `ERPNEXT_ADMIN_PASSWORD` variable
5. Complete setup wizard (country, currency, company, fiscal year)
6. Change admin password

### Installing dealer_management on Railway

Railway requires a custom Docker image for custom apps:

1. Fork the [ERPNext Railway repo](https://github.com/nomideusz/erpnext-railway)
2. Replace `apps.json` with this repo's root [`apps.json`](../apps.json) (ERPNext `version-16` + Dealerbase `main`)
3. Deploy your forked repo to Railway
4. The app will be installed automatically

### Configuration Variables

| Variable | Purpose |
|----------|---------|
| `ERPNEXT_ADMIN_PASSWORD` | Initial admin password (read on first boot only) |
| `ERPNEXT_URL` | Custom domain URL for emails/PDFs |
| `ERPNEXT_WEB_WORKERS` | Number of web workers (scale up for more users) |
| `ERPNEXT_BG_WORKERS` | Number of background workers |

### Backup & Restore

```bash
# Manual backup (via railway ssh)
erpnext-backup

# Restore from weekday backup
erpnext-restore Mon

# Restore from file
erpnext-restore /path/to/backup.tar
```

Backups stored as: `erpnext-Mon.tar` through `erpnext-Sun.tar`

### Limitations

- **Email** - Outbound SMTP requires Railway Pro plan
- **Custom Apps** - Requires custom Docker image (see above)
- **Custom Domain** - Configure in Settings → Networking + set `ERPNEXT_URL`

---

## Other Deployment Options

### Docker Self-Hosted

**Repository:** https://github.com/frappe/frappe_docker

```bash
# Quick start with Docker Compose
git clone https://github.com/frappe/frappe_docker
cd frappe_docker
cp example.env .env
docker compose up -d
```

Best for: Full control, on-premise requirements

### Manual Installation (Bench)

**Docs:** https://frappeframework.com/docs/user/en/installation

```bash
# Install bench
pip install frappe-bench

# Initialize bench
bench init frappe-bench
cd frappe-bench

# Create site
bench new-site dealer.local

# Get ERPNext
bench get-app erpnext
bench --site dealer.local install-app erpnext

# Start development
bench start
```

Best for: Development, heavy customization

---

## Installing Custom App (Dealer Management)

Once ERPNext is deployed, install the custom dealer management app:

### On Railway (via SSH)

```bash
# SSH into the ERPNext service
railway ssh

# Inside the container
cd /home/frappe/frappe-bench
bench get-app https://github.com/YOUR_ORG/dealer_management
bench --site YOUR_SITE install-app dealer_management
bench migrate
```

### On Docker

```bash
docker exec -it <erpnext-container> bash
cd /home/frappe/frappe-bench
bench get-app https://github.com/YOUR_ORG/dealer_management
bench --site YOUR_SITE install-app dealer_management
bench migrate
```

### Local Development

```bash
cd frappe-bench
bench get-app /path/to/dealer_management
bench --site dealer.local install-app dealer_management
bench migrate
bench start
```

---

## Development Workflow

### Recommended Setup

1. **Local Development** - Use bench for development
2. **Staging** - Frappe Cloud staging site (included with Private Bench)
3. **Production** - Frappe Cloud Private Bench

### Creating the Custom App

```bash
# Create new app
bench new-app dealer_management

# This creates the app structure:
# dealer_management/
# ├── dealer_management/
# │   ├── __init__.py
# │   ├── hooks.py
# │   └── dealer_management/
# │       └── doctype/
# └── setup.py
```

### Development Commands

```bash
# Create new DocType
bench --site dealer.local new-doctype Vehicle

# Run migrations after changes
bench --site dealer.local migrate

# Clear cache
bench --site dealer.local clear-cache

# Export fixtures
bench --site dealer.local export-fixtures

# Run tests
bench --site dealer.local run-tests --app dealer_management
```

---

## Cost Comparison

### True Cost of Ownership (Small Dealer, 1-5 users)

| Option | Infrastructure | Your Time | True Monthly Cost |
|--------|----------------|-----------|-------------------|
| **Frappe Cloud Private** | $25-50/mo | 0 hrs | **$25-50/mo** ✅ |
| **Railway** | $10-20/mo | 2 hrs | ~$110/mo* |
| **Self-Hosted VPS** | $25-60/mo | 8 hrs | ~$425/mo* |

*Assuming your time is worth $50/hour

### Frappe Cloud Plans

| Plan | Cost | Custom Apps | Best For |
|------|------|-------------|----------|
| Shared Site | $5-25/mo | ❌ No | Evaluation only |
| **Private Bench** | $25-50/mo | ✅ Yes | **Small dealers** |
| Dedicated Server | $100-500/mo | ✅ Yes | Multi-site, enterprise |

### Railway

| Plan | Cost | Notes |
|------|------|-------|
| Hobby | ~$5-10/mo | Good for starting out |
| Pro | ~$20-50/mo | Required for email |

### Self-Hosted

| Item | Cost |
|------|------|
| VPS (4GB Hetzner) | $15-25/mo |
| VPS (4GB DigitalOcean) | $48/mo |
| Domain | ~$15/year |
| SSL | Free (Let's Encrypt) |
| **Your Time** | 4-10 hrs/month |

---

## Additional Resources

### Documentation

- [ERPNext Documentation](https://docs.erpnext.com/)
- [Frappe Framework Docs](https://frappeframework.com/docs)
- [ERPNext GitHub](https://github.com/frappe/erpnext)
- [Frappe Docker](https://github.com/frappe/frappe_docker)

### Community

- [ERPNext Forum](https://discuss.frappe.io/)
- [ERPNext Discord](https://discord.gg/erpnext)
- [Stack Overflow - ERPNext Tag](https://stackoverflow.com/questions/tagged/erpnext)

### Learning

- [Frappe School](https://frappe.school/) - Official tutorials
- [ERPNext Foundation YouTube](https://www.youtube.com/c/ERPNext)

### API References

- [Frappe API](https://frappeframework.com/docs/user/en/api)
- [ERPNext API](https://docs.erpnext.com/docs/user/manual/en/api)

---

## Quick Start Summary

**For most small independent dealers, here's the fastest path to production:**

1. **Sign up** at [frappecloud.com](https://frappecloud.com)
2. **Create Private Bench** (~$25/mo)
3. **Add app** from GitHub: `https://github.com/lrcarp17/Dealerbase`
4. **Create site** with ERPNext + dealer_management
5. **Complete setup wizard** (5 minutes)
6. **Start adding vehicles!**

Total time: ~30 minutes  
Monthly cost: ~$25-50  
Maintenance required: None
