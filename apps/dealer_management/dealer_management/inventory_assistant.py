"""AI-powered inventory assistant for natural language vehicle management.

Provides a chat interface that lets users query and update their inventory
using plain English commands like:
- "Show me all vehicles awaiting title"
- "Update the 370Z to frontline status"
- "What's our total investment in vehicles currently in recon?"
- "Set the asking price on VIN ending in 3905 to $18,500"
"""

import json

import frappe
from frappe import _
from frappe.utils import flt, today

from dealer_management.ai_usage import (
    UsageTally,
    api_error_message,
    check_budget,
    get_budget_status,
    is_spend_limit_error,
)


TOOLS = [
    {
        "name": "search_vehicles",
        "description": "Search for vehicles in inventory. Returns a list of matching vehicles with key details.",
        "input_schema": {
            "type": "object",
            "properties": {
                "filters": {
                    "type": "object",
                    "description": "Filters to apply. Keys can be: status, make, model, year, vin (partial match), year_min, year_max, price_min, price_max",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results to return. Default 10.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_vehicle_details",
        "description": "Get full details for a specific vehicle by its ID or VIN.",
        "input_schema": {
            "type": "object",
            "properties": {
                "identifier": {
                    "type": "string",
                    "description": "The vehicle ID (e.g., VH-2026-00001) or VIN (full or partial, at least last 6 characters)",
                },
            },
            "required": ["identifier"],
        },
    },
    {
        "name": "update_vehicle",
        "description": "Update fields on a vehicle. Use this to change status, price, or other editable fields.",
        "input_schema": {
            "type": "object",
            "properties": {
                "identifier": {
                    "type": "string",
                    "description": "The vehicle ID or VIN to update",
                },
                "fields": {
                    "type": "object",
                    "description": "Fields to update. Common fields: status, asking_price, floor_price, stock_number, mileage_current",
                },
            },
            "required": ["identifier", "fields"],
        },
    },
    {
        "name": "get_inventory_summary",
        "description": "Get a summary of the current inventory: counts by status, total value, etc.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_sales_summary",
        "description": "Get sales statistics for a time period.",
        "input_schema": {
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "enum": ["today", "this_week", "this_month", "this_year", "all_time"],
                    "description": "Time period for the summary. Default is this_month.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "bulk_update_vehicles",
        "description": "Update multiple vehicles at once that match certain criteria.",
        "input_schema": {
            "type": "object",
            "properties": {
                "filters": {
                    "type": "object",
                    "description": "Filters to select vehicles to update (same as search_vehicles)",
                },
                "fields": {
                    "type": "object",
                    "description": "Fields to update on all matching vehicles",
                },
            },
            "required": ["filters", "fields"],
        },
    },
    {
        "name": "get_token_budget",
        "description": "Get this month's AI token usage (all AI features in the app) against the monthly token budget, with a breakdown by feature and the current Anthropic rate-limit headroom. Use when the user asks about their token budget, AI usage or remaining tokens.",
        "input_schema": {"type": "object", "properties": {}},
    },
]


def _find_vehicle(identifier):
    """Find a vehicle by ID or VIN (full or partial)."""
    if not identifier:
        return None
    identifier = identifier.strip().upper()
    if frappe.db.exists("Vehicle Inventory", identifier):
        return identifier
    vin_match = frappe.db.get_value(
        "Vehicle Inventory", {"vin": ("like", f"%{identifier}")}, "name"
    )
    if vin_match:
        return vin_match
    vin_match = frappe.db.get_value(
        "Vehicle Inventory", {"vin": identifier}, "name"
    )
    return vin_match


def _vehicle_to_dict(doc):
    """Convert a vehicle document to a summary dict."""
    return {
        "id": doc.name,
        "vin": doc.vin,
        "year": doc.year,
        "make": doc.make,
        "model": doc.model,
        "trim": doc.trim,
        "status": doc.status,
        "asking_price": flt(doc.asking_price),
        "total_investment": flt(doc.total_investment),
        "mileage": doc.mileage_current,
        "exterior_color": doc.exterior_color,
        "days_on_lot": doc.days_on_lot,
    }


def tool_search_vehicles(filters=None, limit=10):
    """Search for vehicles matching the given filters."""
    frappe.has_permission("Vehicle Inventory", "read", throw=True)

    filters = filters or {}
    db_filters = {}

    if filters.get("status"):
        db_filters["status"] = filters["status"]
    if filters.get("make"):
        db_filters["make"] = ("like", f"%{filters['make']}%")
    if filters.get("model"):
        db_filters["model"] = ("like", f"%{filters['model']}%")
    if filters.get("year"):
        db_filters["year"] = filters["year"]
    if filters.get("vin"):
        db_filters["vin"] = ("like", f"%{filters['vin'].upper()}%")

    vehicles = frappe.get_all(
        "Vehicle Inventory",
        filters=db_filters,
        fields=["name", "vin", "year", "make", "model", "trim", "status", 
                "asking_price", "total_investment", "mileage_current", 
                "exterior_color", "days_on_lot"],
        limit=limit,
        order_by="modified desc",
    )

    if filters.get("year_min"):
        vehicles = [v for v in vehicles if v.year and v.year >= filters["year_min"]]
    if filters.get("year_max"):
        vehicles = [v for v in vehicles if v.year and v.year <= filters["year_max"]]
    if filters.get("price_min"):
        vehicles = [v for v in vehicles if flt(v.asking_price) >= filters["price_min"]]
    if filters.get("price_max"):
        vehicles = [v for v in vehicles if flt(v.asking_price) <= filters["price_max"]]

    return {
        "count": len(vehicles),
        "vehicles": [
            {
                "id": v.name,
                "vin": v.vin,
                "year": v.year,
                "make": v.make,
                "model": v.model,
                "trim": v.trim,
                "status": v.status,
                "asking_price": flt(v.asking_price),
                "total_investment": flt(v.total_investment),
                "mileage": v.mileage_current,
                "color": v.exterior_color,
                "days_on_lot": v.days_on_lot,
            }
            for v in vehicles
        ],
    }


def tool_get_vehicle_details(identifier):
    """Get full details for a specific vehicle."""
    frappe.has_permission("Vehicle Inventory", "read", throw=True)

    vehicle_id = _find_vehicle(identifier)
    if not vehicle_id:
        return {"error": f"No vehicle found matching '{identifier}'"}

    doc = frappe.get_doc("Vehicle Inventory", vehicle_id)
    return {
        "id": doc.name,
        "vin": doc.vin,
        "stock_number": doc.stock_number,
        "year": doc.year,
        "make": doc.make,
        "model": doc.model,
        "trim": doc.trim,
        "body_style": doc.body_style,
        "exterior_color": doc.exterior_color,
        "interior_color": doc.interior_color,
        "mileage_in": doc.mileage_in,
        "mileage_current": doc.mileage_current,
        "transmission": doc.transmission,
        "drivetrain": doc.drivetrain,
        "fuel_type": doc.fuel_type,
        "engine": doc.engine,
        "status": doc.status,
        "title_status": doc.title_status,
        "title_received": bool(doc.title_received),
        "has_lien": bool(doc.has_lien),
        "asking_price": flt(doc.asking_price),
        "floor_price": flt(doc.floor_price),
        "total_investment": flt(doc.total_investment),
        "potential_profit": flt(doc.potential_profit),
        "acquisition_date": str(doc.acquisition_date) if doc.acquisition_date else None,
        "days_on_lot": doc.days_on_lot,
        "features": doc.features,
    }


def tool_update_vehicle(identifier, fields):
    """Update fields on a vehicle."""
    frappe.has_permission("Vehicle Inventory", "write", throw=True)

    vehicle_id = _find_vehicle(identifier)
    if not vehicle_id:
        return {"error": f"No vehicle found matching '{identifier}'"}

    doc = frappe.get_doc("Vehicle Inventory", vehicle_id)

    allowed_fields = {
        "status", "asking_price", "floor_price", "stock_number",
        "mileage_current", "exterior_color", "interior_color",
        "title_status", "title_received", "features", "description",
    }

    updated = []
    for field, value in fields.items():
        if field in allowed_fields:
            old_value = doc.get(field)
            doc.set(field, value)
            updated.append({"field": field, "old": old_value, "new": value})

    if updated:
        doc.save()
        return {
            "success": True,
            "vehicle_id": doc.name,
            "vehicle": f"{doc.year} {doc.make} {doc.model}",
            "updated_fields": updated,
        }
    else:
        return {"error": "No valid fields to update"}


def tool_get_inventory_summary():
    """Get inventory statistics."""
    frappe.has_permission("Vehicle Inventory", "read", throw=True)

    status_counts = frappe.db.sql(
        """
        SELECT status, COUNT(*) as count, 
               SUM(COALESCE(asking_price, 0)) as total_asking,
               SUM(COALESCE(total_investment, 0)) as total_investment
        FROM `tabVehicle Inventory`
        WHERE status NOT IN ('Sold', 'Wholesale')
        GROUP BY status
        """,
        as_dict=True,
    )

    total_vehicles = sum(s["count"] for s in status_counts)
    total_asking = sum(flt(s["total_asking"]) for s in status_counts)
    total_investment = sum(flt(s["total_investment"]) for s in status_counts)

    return {
        "total_vehicles": total_vehicles,
        "total_asking_value": total_asking,
        "total_investment": total_investment,
        "potential_profit": total_asking - total_investment,
        "by_status": {s["status"]: s["count"] for s in status_counts},
    }


def tool_get_sales_summary(period="this_month"):
    """Get sales statistics for a time period."""
    frappe.has_permission("Vehicle Sale", "read", throw=True)

    date_filter = ""
    if period == "today":
        date_filter = f"AND sale_date = '{today()}'"
    elif period == "this_week":
        date_filter = "AND YEARWEEK(sale_date) = YEARWEEK(CURDATE())"
    elif period == "this_month":
        date_filter = "AND YEAR(sale_date) = YEAR(CURDATE()) AND MONTH(sale_date) = MONTH(CURDATE())"
    elif period == "this_year":
        date_filter = "AND YEAR(sale_date) = YEAR(CURDATE())"

    stats = frappe.db.sql(
        f"""
        SELECT 
            COUNT(*) as count,
            SUM(COALESCE(sale_price, 0)) as total_revenue,
            AVG(COALESCE(sale_price, 0)) as avg_sale_price
        FROM `tabVehicle Sale`
        WHERE docstatus < 2 {date_filter}
        """,
        as_dict=True,
    )[0]

    return {
        "period": period,
        "vehicles_sold": stats["count"] or 0,
        "total_revenue": flt(stats["total_revenue"]),
        "average_sale_price": flt(stats["avg_sale_price"]),
    }


def tool_bulk_update_vehicles(filters, fields):
    """Update multiple vehicles matching the filters."""
    frappe.has_permission("Vehicle Inventory", "write", throw=True)

    search_result = tool_search_vehicles(filters, limit=100)
    if not search_result["vehicles"]:
        return {"error": "No vehicles match the given filters"}

    updated_count = 0
    updated_vehicles = []

    for v in search_result["vehicles"]:
        result = tool_update_vehicle(v["id"], fields)
        if result.get("success"):
            updated_count += 1
            updated_vehicles.append(f"{v['year']} {v['make']} {v['model']} ({v['id']})")

    return {
        "success": True,
        "updated_count": updated_count,
        "updated_vehicles": updated_vehicles[:10],
        "more": len(updated_vehicles) > 10,
    }


def tool_get_token_budget():
    """This month's AI token use against the budget set in AI Settings."""
    status = get_budget_status()
    status.pop("can_configure", None)
    if not status["budget"]:
        status["note"] = "No monthly token budget is set in AI Settings; usage is tracked but not limited."
    status["note_on_balance"] = (
        "This is the app's own budget. The Anthropic account's credit balance and spend limit "
        "are only visible in the Claude Console billing page."
    )
    return status


TOOL_FUNCTIONS = {
    "search_vehicles": tool_search_vehicles,
    "get_vehicle_details": tool_get_vehicle_details,
    "update_vehicle": tool_update_vehicle,
    "get_inventory_summary": tool_get_inventory_summary,
    "get_sales_summary": tool_get_sales_summary,
    "bulk_update_vehicles": tool_bulk_update_vehicles,
    "get_token_budget": tool_get_token_budget,
}


def _get_system_prompt():
    dealer = frappe.defaults.get_global_default("company") or "the dealership"
    return f"""You are an inventory assistant for {dealer}, an independent auto dealer. 
You help manage their vehicle inventory through natural conversation.

You have access to tools to search, view, and update vehicles. Use them to answer questions
and make changes as requested.

Guidelines:
- When showing vehicle lists, format them clearly with key details (year, make, model, status, price)
- When updating vehicles, confirm what you're about to change before doing it
- Use the inventory summary tool to answer questions about totals and statistics
- Use the token budget tool for questions about AI token usage, the monthly token budget or remaining tokens
- For VINs, users often provide just the last few characters - that's enough to find a vehicle
- Currency values are in USD
- Be concise but helpful

Common status values: Awaiting Pickup, Awaiting Title, Pre-Sale, In Recon, Frontline, Available, Pending Sale, Sold, Wholesale, Problem"""


@frappe.whitelist()
def chat(message, conversation_history=None):
    """Process a chat message and return the assistant's response.
    
    Args:
        message: The user's message
        conversation_history: Optional JSON string of previous messages
    
    Returns:
        dict with 'response' (assistant's message) and 'conversation' (updated history)
    """
    import anthropic

    from dealer_management.dealer_management.doctype.ai_settings.ai_settings import (
        get_anthropic_credentials,
    )

    frappe.has_permission("Vehicle Inventory", "read", throw=True)

    api_key, workspace_id, model = get_anthropic_credentials()
    if not api_key:
        frappe.throw(
            _("Configure an Anthropic API key in AI Settings to use the inventory assistant."),
            title=_("Not Configured"),
        )
    check_budget()

    conversation_history = frappe.parse_json(conversation_history) if conversation_history else []
    conversation_history.append({"role": "user", "content": message})

    default_headers = {"anthropic-workspace-id": workspace_id} if workspace_id else None
    client = anthropic.Anthropic(api_key=api_key, default_headers=default_headers)

    messages = conversation_history.copy()
    tally = UsageTally("Inventory Assistant", model)

    try:
        while True:
            raw = client.messages.with_raw_response.create(
                model=model or "claude-sonnet-4-20250514",
                max_tokens=4096,
                system=_get_system_prompt(),
                tools=TOOLS,
                messages=messages,
            )
            response = tally.add_raw(raw)

            if response.stop_reason == "tool_use":
                tool_results = []
                assistant_content = response.content

                for block in response.content:
                    if block.type == "tool_use":
                        tool_name = block.name
                        tool_input = block.input
                        tool_fn = TOOL_FUNCTIONS.get(tool_name)

                        if tool_fn:
                            try:
                                result = tool_fn(**tool_input)
                            except Exception as e:
                                result = {"error": str(e)}
                        else:
                            result = {"error": f"Unknown tool: {tool_name}"}

                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result),
                        })

                messages.append({"role": "assistant", "content": assistant_content})
                messages.append({"role": "user", "content": tool_results})
            else:
                break
    except anthropic.APIError as e:
        # Tokens spent before the failure still count against the budget.
        tally.save()
        _raise_api_error(e)

    tally.save()

    assistant_message = ""
    for block in response.content:
        if hasattr(block, "text"):
            assistant_message += block.text

    conversation_history.append({"role": "assistant", "content": assistant_message})

    return {
        "response": assistant_message,
        "conversation": conversation_history,
        "usage": tally.as_dict(),
    }


def _raise_api_error(error):
    import anthropic

    if isinstance(error, anthropic.AuthenticationError):
        frappe.throw(_("The Anthropic API key was rejected. Check AI Settings."))
    if isinstance(error, anthropic.APIStatusError) and is_spend_limit_error(error):
        frappe.throw(
            _("Your Anthropic account has reached its spend limit: {0}").format(api_error_message(error)),
            title=_("Anthropic Spend Limit Reached"),
        )
    if isinstance(error, anthropic.RateLimitError):
        frappe.throw(_("The assistant is getting too many requests right now. Please try again in a minute."))
    if isinstance(error, anthropic.APIConnectionError):
        frappe.throw(_("Could not reach Anthropic. Check the server's internet access."))
    message = api_error_message(error) if isinstance(error, anthropic.APIStatusError) else str(error)
    frappe.log_error(title="Inventory assistant request failed", message=message)
    frappe.throw(_("The assistant could not answer: {0}").format(message))
