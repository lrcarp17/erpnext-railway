// Dashboard for Dealer Management workspace
frappe.provide("dealer_management");

dealer_management.render_dashboard = function () {
  const route = frappe.get_route();
  
  // Check if we're on the Dealer Management workspace
  // Route can be ["Workspaces", "Dealer Management"] or ["Workspaces", "Dealer%20Management"]
  if (route[0] !== "Workspaces") return;
  
  const workspaceName = decodeURIComponent(route[1] || "");
  if (workspaceName !== "Dealer Management") return;

  const workspace = document.querySelector(".workspace-main-section");
  if (!workspace) return;

  const existingDashboard = document.getElementById("dealer-dashboard");
  if (existingDashboard) return;

  const dashboardHtml = `
    <div id="dealer-dashboard" class="dealer-dashboard">
      <h4 class="dashboard-title">Dashboard</h4>
      <div class="dashboard-loading">Loading metrics...</div>
      <div class="dashboard-cards" style="display: none;"></div>
      <div class="dashboard-chart-container" style="display: none;">
        <h5>Inventory by Status</h5>
        <div id="status-chart"></div>
      </div>
    </div>
    <style>
      .dealer-dashboard {
        padding: 1rem 0 2rem 0;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 1rem;
      }
      .dashboard-title {
        margin-bottom: 1rem;
        font-weight: 600;
      }
      .dashboard-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .dashboard-card {
        background: var(--card-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 1rem;
        text-align: center;
      }
      .dashboard-card .card-value {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--text-color);
        line-height: 1.2;
      }
      .dashboard-card .card-label {
        font-size: 0.85rem;
        color: var(--text-muted);
        margin-top: 0.25rem;
      }
      .dashboard-card.highlight {
        border-color: var(--primary);
        background: var(--subtle-accent);
      }
      .dashboard-chart-container {
        margin-top: 1rem;
      }
      .dashboard-chart-container h5 {
        margin-bottom: 0.5rem;
        font-weight: 500;
      }
      #status-chart {
        height: 250px;
      }
    </style>
  `;

  workspace.insertAdjacentHTML("afterbegin", dashboardHtml);
  loadDashboardData();
};

function loadDashboardData() {
  frappe.call({
    method: "dealer_management.dashboard_api.get_dashboard_data",
    callback: function (r) {
      if (r.message) {
        renderDashboard(r.message);
      }
    },
    error: function () {
      document.querySelector(".dashboard-loading").textContent =
        "Could not load dashboard data";
    },
  });
}

function renderDashboard(data) {
  const loading = document.querySelector(".dashboard-loading");
  const cards = document.querySelector(".dashboard-cards");
  const chartContainer = document.querySelector(".dashboard-chart-container");

  if (!data.inventory) {
    loading.textContent = "No data available";
    return;
  }

  loading.style.display = "none";
  cards.style.display = "grid";
  chartContainer.style.display = "block";

  const inv = data.inventory;
  const sales = data.sales;

  cards.innerHTML = `
    <div class="dashboard-card highlight">
      <div class="card-value">${inv.total}</div>
      <div class="card-label">Total Inventory</div>
    </div>
    <div class="dashboard-card">
      <div class="card-value">${inv.awaiting_pickup}</div>
      <div class="card-label">Awaiting Pickup</div>
    </div>
    <div class="dashboard-card">
      <div class="card-value">${inv.awaiting_title}</div>
      <div class="card-label">Awaiting Title</div>
    </div>
    <div class="dashboard-card">
      <div class="card-value">${inv.frontline_ready}</div>
      <div class="card-label">Frontline Ready</div>
    </div>
    <div class="dashboard-card highlight">
      <div class="card-value">${sales.this_month.count}</div>
      <div class="card-label">Sold This Month</div>
    </div>
    <div class="dashboard-card">
      <div class="card-value">${format_currency(sales.this_month.revenue)}</div>
      <div class="card-label">Revenue This Month</div>
    </div>
  `;

  if (data.status_breakdown && data.status_breakdown.length > 0) {
    renderStatusChart(data.status_breakdown);
  }
}

function format_currency(value) {
  if (value >= 1000000) {
    return "$" + (value / 1000000).toFixed(1) + "M";
  } else if (value >= 1000) {
    return "$" + (value / 1000).toFixed(0) + "K";
  }
  return "$" + value.toFixed(0);
}

function renderStatusChart(breakdown) {
  const labels = breakdown.map((d) => d.status);
  const values = breakdown.map((d) => d.count);
  const colors = [
    "#FF6B6B", // Awaiting Pickup - red
    "#FFAB40", // Awaiting Title - orange
    "#FFD93D", // Pre-Sale - yellow
    "#6BCB77", // In Recon - green
    "#4D96FF", // Frontline - blue
    "#36D399", // Available - teal
    "#7C3AED", // Pending Sale - purple
    "#6B7280", // Problem - gray
  ];

  new frappe.Chart("#status-chart", {
    data: {
      labels: labels,
      datasets: [{ values: values }],
    },
    type: "donut",
    height: 250,
    colors: colors.slice(0, labels.length),
  });
}

// Run on page changes
$(document).on("page-change", function () {
  setTimeout(dealer_management.render_dashboard, 300);
});

// Run on route changes
frappe.router.on("change", function () {
  setTimeout(dealer_management.render_dashboard, 300);
});

// Run on initial load after a delay
$(document).ready(function () {
  setTimeout(dealer_management.render_dashboard, 500);
});

// Also try when workspace is fully loaded
$(document).on("workspace-loaded", function () {
  setTimeout(dealer_management.render_dashboard, 100);
});

// Fallback: check periodically for the first few seconds
let checkCount = 0;
const checkInterval = setInterval(function () {
  checkCount++;
  dealer_management.render_dashboard();
  if (checkCount >= 10) {
    clearInterval(checkInterval);
  }
}, 500);
