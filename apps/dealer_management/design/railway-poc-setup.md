# Railway POC Deployment Guide

## Quick Start (15 minutes)

### Step 1: Fork the ERPNext Railway Template

1. Go to: https://github.com/nomideusz/erpnext-railway
2. Click **Fork** (top right)
3. Name it: `dealerbase-erpnext` (or similar)
4. Click **Create fork**

### Step 2: Add Your Custom App

In your forked repo, replace `apps.json` with the contents of this repo's root [`apps.json`](../apps.json) (ERPNext `version-16` + Dealerbase `main`).

Commit this change.

### Step 3: Deploy to Railway

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose your forked `dealerbase-erpnext` repo
5. Railway will auto-detect and start building

### Step 4: Configure Environment Variables

In Railway dashboard, add these variables to your ERPNext service:

| Variable | Value |
|----------|-------|
| `ERPNEXT_ADMIN_PASSWORD` | (set a strong password) |
| `ERPNEXT_SITE_NAME` | `dealer.railway.app` (or your domain) |

### Step 5: Wait for Build (~10-15 minutes)

Railway will:
1. Build the Docker image with ERPNext + dealer_management
2. Start MariaDB
3. Create your site
4. Install apps

### Step 6: Access Your Site

1. Go to your Railway dashboard
2. Click on the ERPNext service
3. Find the public URL (e.g., `xxx.up.railway.app`)
4. Login as `Administrator` with the password you set

### Step 7: Complete Setup Wizard

1. Select your country, currency
2. Enter company name (your dealership or "Demo Dealer")
3. Set fiscal year
4. Click Complete

### Step 8: Access Dealer Management

1. Click the search bar (or press `/`)
2. Type "Dealer Management"
3. Click to open the workspace

---

## Expected Costs

| Plan | Cost | Limits |
|------|------|--------|
| **Hobby** | $5/mo | 512MB RAM, good for POC |
| **Pro** | $20/mo | More RAM, email support |

For a POC with 1-2 users, Hobby plan is fine.

---

## Troubleshooting

### Build fails
- Check the build logs in Railway
- Common issue: apps.json syntax error (validate JSON)

### Site not loading
- Wait for full build completion (~10-15 min first time)
- Check the deploy logs

### Can't login
- Check `ERPNEXT_ADMIN_PASSWORD` variable
- Try resetting via Railway shell: `bench --site [site] set-admin-password newpassword`

### App not showing
- Verify apps.json includes dealer_management
- Check install logs: `bench --site [site] list-apps`

---

## Custom Domain (Optional)

1. In Railway, go to your service → Settings → Networking
2. Add your domain: `erp.yourdealership.com`
3. Add DNS record:
   ```
   Type: CNAME
   Name: erp
   Value: xxx.up.railway.app
   ```
4. Set `ERPNEXT_URL` variable to `https://erp.yourdealership.com`

---

## Backup Your POC

### Manual Backup
```bash
# Via Railway shell
railway ssh
erpnext-backup
```

### Download Backup
Backups are stored in the Railway bucket as `erpnext-Mon.tar` through `erpnext-Sun.tar`.

---

## When to Scale

Move to Frappe Cloud or Kubernetes when:
- ✅ You have 5+ paying customers
- ✅ You need better uptime guarantees
- ✅ You need isolated customer environments
- ✅ Monthly cost on Railway exceeds $100

For now, Railway is perfect for POC and early customers.
