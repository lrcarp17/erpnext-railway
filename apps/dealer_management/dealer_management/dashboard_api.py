"""Dashboard API for the Dealerbase home page."""

import frappe
from frappe.utils import add_months, flt, getdate, today

# Statuses a vehicle moves through before it is sold, in pipeline order.
PIPELINE_STATUSES = [
    "Awaiting Pickup",
    "Awaiting Title",
    "Pre-Sale",
    "In Recon",
    "Frontline",
    "Available",
    "Pending Sale",
    "Problem",
]
CLOSED_STATUSES = ("Sold", "Wholesale")


@frappe.whitelist()
def get_dashboard_data():
    """Return all metrics for the Dealerbase home page.

    Sections the user has no read access to come back as None, so the page can
    hide them instead of failing as a whole.
    """
    frappe.has_permission("Dealer Vehicle", "read", throw=True)

    can_read_sales = frappe.has_permission("Vehicle Sale", "read")
    can_read_leads = frappe.has_permission("Dealer Lead", "read")

    return {
        "inventory": get_inventory_metrics(),
        "sales": get_sales_metrics() if can_read_sales else None,
        "status_breakdown": get_status_breakdown(),
        "aging": get_aging_buckets(),
        "recent_vehicles": get_recent_vehicles(),
        "recent_sales": get_recent_sales() if can_read_sales else None,
        "leads": get_lead_metrics() if can_read_leads else None,
        "nav": get_nav_counts(),
    }


def get_nav_counts():
    """Small figures for the home page's navigation tiles, one per list the user can read."""
    first_of_month = getdate(today()).replace(day=1)
    this_month = {"creation": [">=", first_of_month]}
    counts = {}

    def count(doctype, filters=None):
        if frappe.has_permission(doctype, "read"):
            counts[doctype] = frappe.db.count(doctype, filters)

    count("Vehicle Acquisition", this_month)
    count("Vehicle Condition")
    count("Vehicle Market Info")
    count("Acquisition Source")
    count("Listing Platform")
    count("Lienholder")
    count("Expense Category")

    if frappe.has_permission("Company Expense", "read"):
        row = frappe.db.sql(
            """SELECT COUNT(*) AS count, SUM(COALESCE(amount, 0)) AS total
            FROM `tabCompany Expense` WHERE expense_date >= %s""",
            (first_of_month,),
            as_dict=True,
        )[0]
        counts["Company Expense"] = {"count": row.count or 0, "total": flt(row.total)}

    return counts


def _lot_age_sql():
    # days_on_lot is only refreshed when a vehicle is saved, so age is computed live.
    return "DATEDIFF(CURDATE(), COALESCE(lot_date, acquisition_date, DATE(creation)))"


def get_inventory_metrics():
    """Get inventory counts and values."""
    result = frappe.db.sql(
        f"""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Awaiting Pickup' THEN 1 ELSE 0 END) as awaiting_pickup,
            SUM(CASE WHEN status = 'Awaiting Title' THEN 1 ELSE 0 END) as awaiting_title,
            SUM(CASE WHEN status = 'Pre-Sale' THEN 1 ELSE 0 END) as pre_sale,
            SUM(CASE WHEN status = 'In Recon' THEN 1 ELSE 0 END) as in_recon,
            SUM(CASE WHEN status IN ('Frontline', 'Available') THEN 1 ELSE 0 END) as frontline_ready,
            SUM(CASE WHEN status = 'Pending Sale' THEN 1 ELSE 0 END) as pending_sale,
            SUM(CASE WHEN status = 'Problem' THEN 1 ELSE 0 END) as problem,
            SUM(COALESCE(asking_price, 0)) as total_asking,
            SUM(COALESCE(total_investment, 0)) as total_investment,
            AVG({_lot_age_sql()}) as avg_age
        FROM `tabDealer Vehicle`
        WHERE status NOT IN %(closed)s
        """,
        {"closed": CLOSED_STATUSES},
        as_dict=True,
    )[0]

    return {
        "total": result.total or 0,
        "awaiting_pickup": result.awaiting_pickup or 0,
        "awaiting_title": result.awaiting_title or 0,
        "pre_sale": result.pre_sale or 0,
        "in_recon": result.in_recon or 0,
        "frontline_ready": result.frontline_ready or 0,
        "pending_sale": result.pending_sale or 0,
        "problem": result.problem or 0,
        "total_asking_value": flt(result.total_asking),
        "total_investment": flt(result.total_investment),
        "potential_profit": flt(result.total_asking) - flt(result.total_investment),
        "avg_days_on_lot": round(flt(result.avg_age)),
    }


def _sales_between(start, end, end_inclusive=True):
    op = "<=" if end_inclusive else "<"
    row = frappe.db.sql(
        f"""
        SELECT
            COUNT(*) as count,
            SUM(COALESCE(sale_price, 0)) as revenue,
            SUM(COALESCE(gross_profit, 0)) as gross_profit
        FROM `tabVehicle Sale`
        WHERE sale_date >= %s AND sale_date {op} %s
        """,
        (start, end),
        as_dict=True,
    )[0]
    return {
        "count": row.count or 0,
        "revenue": flt(row.revenue),
        "gross_profit": flt(row.gross_profit),
    }


def get_sales_metrics():
    """Get sales statistics for the current month, last month and this year."""
    today_date = getdate(today())
    first_of_month = today_date.replace(day=1)
    last_month_start = add_months(first_of_month, -1)
    first_of_year = today_date.replace(month=1, day=1)

    return {
        "this_month": _sales_between(first_of_month, today_date),
        "last_month": _sales_between(last_month_start, first_of_month, end_inclusive=False),
        "this_year": _sales_between(first_of_year, today_date),
        "trend": get_monthly_trend(first_of_month),
    }


def get_monthly_trend(first_of_month, months=6):
    """Units sold and revenue for each of the last `months` months, oldest first."""
    start = add_months(first_of_month, -(months - 1))
    rows = frappe.db.sql(
        """
        SELECT DATE_FORMAT(sale_date, '%%Y-%%m') as month,
            COUNT(*) as count,
            SUM(COALESCE(sale_price, 0)) as revenue
        FROM `tabVehicle Sale`
        WHERE sale_date >= %s
        GROUP BY month
        """,
        (start,),
        as_dict=True,
    )
    by_month = {r.month: r for r in rows}

    trend = []
    for i in range(months):
        month_start = getdate(add_months(start, i))
        key = month_start.strftime("%Y-%m")
        row = by_month.get(key)
        trend.append(
            {
                "month": key,
                "label": month_start.strftime("%b"),
                "count": (row.count if row else 0) or 0,
                "revenue": flt(row.revenue) if row else 0,
            }
        )
    return trend


def get_status_breakdown():
    """Get open vehicle counts by status, in pipeline order."""
    result = frappe.db.sql(
        """
        SELECT status, COUNT(*) as count
        FROM `tabDealer Vehicle`
        WHERE status NOT IN %(closed)s
        GROUP BY status
        """,
        {"closed": CLOSED_STATUSES},
        as_dict=True,
    )
    counts = {r.status: r.count for r in result}
    return [{"status": s, "count": counts.get(s, 0)} for s in PIPELINE_STATUSES]


def get_aging_buckets():
    """Open inventory grouped by days on the lot."""
    row = frappe.db.sql(
        f"""
        SELECT
            SUM(CASE WHEN age <= 30 THEN 1 ELSE 0 END) as fresh,
            SUM(CASE WHEN age > 30 AND age <= 60 THEN 1 ELSE 0 END) as aging,
            SUM(CASE WHEN age > 60 AND age <= 90 THEN 1 ELSE 0 END) as stale,
            SUM(CASE WHEN age > 90 THEN 1 ELSE 0 END) as critical
        FROM (
            SELECT {_lot_age_sql()} as age
            FROM `tabDealer Vehicle`
            WHERE status NOT IN %(closed)s
        ) t
        """,
        {"closed": CLOSED_STATUSES},
        as_dict=True,
    )[0]
    return [
        {"label": "0–30 days", "key": "fresh", "count": row.fresh or 0},
        {"label": "31–60 days", "key": "aging", "count": row.aging or 0},
        {"label": "61–90 days", "key": "stale", "count": row.stale or 0},
        {"label": "90+ days", "key": "critical", "count": row.critical or 0},
    ]


def get_recent_vehicles(limit=6):
    """Most recently added open vehicles."""
    return frappe.db.sql(
        f"""
        SELECT name, year, make, model, `trim`, status, asking_price, stock_number,
            {_lot_age_sql()} as age
        FROM `tabDealer Vehicle`
        WHERE status NOT IN %(closed)s
        ORDER BY creation DESC
        LIMIT %(limit)s
        """,
        {"closed": CLOSED_STATUSES, "limit": limit},
        as_dict=True,
    )


def get_recent_sales(limit=5):
    """Latest sales with the vehicle they were for."""
    return frappe.db.sql(
        """
        SELECT s.name, s.sale_date, s.buyer_name, s.sale_price, s.gross_profit,
            v.year, v.make, v.model
        FROM `tabVehicle Sale` s
        LEFT JOIN `tabDealer Vehicle` v ON v.name = s.vehicle
        ORDER BY s.sale_date DESC, s.creation DESC
        LIMIT %(limit)s
        """,
        {"limit": limit},
        as_dict=True,
    )


def get_lead_metrics():
    """Open leads and the follow-ups that are due."""
    today_date = getdate(today())
    row = frappe.db.sql(
        """
        SELECT
            SUM(CASE WHEN status NOT IN ('Sold', 'Lost') THEN 1 ELSE 0 END) as open,
            SUM(CASE WHEN status = 'New' THEN 1 ELSE 0 END) as new,
            SUM(CASE WHEN status NOT IN ('Sold', 'Lost')
                AND next_follow_up IS NOT NULL AND next_follow_up <= %(today)s
                THEN 1 ELSE 0 END) as due
        FROM `tabDealer Lead`
        """,
        {"today": today_date},
        as_dict=True,
    )[0]

    follow_ups = frappe.db.sql(
        """
        SELECT name, first_name, last_name, status, next_follow_up, phone, timeline
        FROM `tabDealer Lead`
        WHERE status NOT IN ('Sold', 'Lost')
            AND next_follow_up IS NOT NULL AND next_follow_up <= %(today)s
        ORDER BY next_follow_up ASC
        LIMIT 5
        """,
        {"today": today_date},
        as_dict=True,
    )

    return {
        "open": row.open or 0,
        "new": row.new or 0,
        "follow_ups_due": row.due or 0,
        "follow_ups": follow_ups,
    }
