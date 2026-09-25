"""Dashboard API for Dealer Management homepage metrics."""

import frappe
from frappe.utils import flt, getdate, today, add_months


@frappe.whitelist()
def get_dashboard_data():
    """Return all dashboard metrics for the Dealer Management workspace."""
    frappe.has_permission("Dealer Vehicle", "read", throw=True)

    return {
        "inventory": get_inventory_metrics(),
        "sales": get_sales_metrics(),
        "status_breakdown": get_status_breakdown(),
    }


def get_inventory_metrics():
    """Get inventory counts and values."""
    result = frappe.db.sql(
        """
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Awaiting Pickup' THEN 1 ELSE 0 END) as awaiting_pickup,
            SUM(CASE WHEN status = 'Awaiting Title' THEN 1 ELSE 0 END) as awaiting_title,
            SUM(CASE WHEN status = 'Pre-Sale' THEN 1 ELSE 0 END) as pre_sale,
            SUM(CASE WHEN status = 'In Recon' THEN 1 ELSE 0 END) as in_recon,
            SUM(CASE WHEN status IN ('Frontline', 'Available') THEN 1 ELSE 0 END) as frontline_ready,
            SUM(CASE WHEN status = 'Pending Sale' THEN 1 ELSE 0 END) as pending_sale,
            SUM(COALESCE(asking_price, 0)) as total_asking,
            SUM(COALESCE(total_investment, 0)) as total_investment
        FROM `tabDealer Vehicle`
        WHERE status NOT IN ('Sold', 'Wholesale')
        """,
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
        "total_asking_value": flt(result.total_asking),
        "total_investment": flt(result.total_investment),
        "potential_profit": flt(result.total_asking) - flt(result.total_investment),
    }


def get_sales_metrics():
    """Get sales statistics for current month and comparison."""
    today_date = getdate(today())
    first_of_month = today_date.replace(day=1)
    last_month_start = add_months(first_of_month, -1)

    this_month = frappe.db.sql(
        """
        SELECT 
            COUNT(*) as count,
            SUM(COALESCE(sale_price, 0)) as revenue
        FROM `tabVehicle Sale`
        WHERE sale_date >= %s AND sale_date <= %s
        """,
        (first_of_month, today_date),
        as_dict=True,
    )[0]

    last_month = frappe.db.sql(
        """
        SELECT 
            COUNT(*) as count,
            SUM(COALESCE(sale_price, 0)) as revenue
        FROM `tabVehicle Sale`
        WHERE sale_date >= %s AND sale_date < %s
        """,
        (last_month_start, first_of_month),
        as_dict=True,
    )[0]

    this_year = frappe.db.sql(
        """
        SELECT 
            COUNT(*) as count,
            SUM(COALESCE(sale_price, 0)) as revenue
        FROM `tabVehicle Sale`
        WHERE YEAR(sale_date) = YEAR(CURDATE())
        """,
        as_dict=True,
    )[0]

    return {
        "this_month": {
            "count": this_month.count or 0,
            "revenue": flt(this_month.revenue),
        },
        "last_month": {
            "count": last_month.count or 0,
            "revenue": flt(last_month.revenue),
        },
        "this_year": {
            "count": this_year.count or 0,
            "revenue": flt(this_year.revenue),
        },
    }


def get_status_breakdown():
    """Get vehicle counts by status for chart."""
    result = frappe.db.sql(
        """
        SELECT status, COUNT(*) as count
        FROM `tabDealer Vehicle`
        WHERE status NOT IN ('Sold', 'Wholesale')
        GROUP BY status
        ORDER BY FIELD(status, 
            'Awaiting Pickup', 'Awaiting Title', 'Pre-Sale', 
            'In Recon', 'Frontline', 'Available', 'Pending Sale', 'Problem')
        """,
        as_dict=True,
    )

    return [{"status": r.status, "count": r.count} for r in result]
