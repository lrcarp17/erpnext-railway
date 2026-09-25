"""Token usage tracking and the monthly token budget for AI features.

The Anthropic API has no endpoint that reports a standard API key's credit
balance, so the budget is kept here: every Claude response carries its token
usage, which is recorded in AI Usage Log and summed per calendar month. Each
response also carries rate-limit headers, the latest of which are cached so the
assistant can show how much per-minute headroom is left.
"""

import frappe
from frappe import _
from frappe.utils import add_months, cint, getdate, today

RATE_LIMIT_CACHE_KEY = "dealer_management:anthropic_rate_limits"

# Response headers from https://platform.claude.com/docs/en/api/rate-limits#response-headers
RATE_LIMIT_HEADERS = {
    "requests": "anthropic-ratelimit-requests",
    "tokens": "anthropic-ratelimit-tokens",
    "input_tokens": "anthropic-ratelimit-input-tokens",
    "output_tokens": "anthropic-ratelimit-output-tokens",
}


class UsageTally:
    """Adds up usage across the requests one feature makes for a single user action."""

    def __init__(self, feature, model):
        self.feature = feature
        self.model = model
        self.requests = 0
        self.input_tokens = 0
        self.output_tokens = 0
        self.cache_read_tokens = 0
        self.cache_write_tokens = 0
        self.rate_limits = None

    def add_raw(self, raw):
        """Record a `.with_raw_response` result and return the parsed Message."""
        self.rate_limits = parse_rate_limits(raw.headers) or self.rate_limits
        message = raw.parse()
        self.add(message)
        return message

    def add(self, message):
        usage = getattr(message, "usage", None)
        if not usage:
            return
        self.requests += 1
        self.model = getattr(message, "model", None) or self.model
        self.input_tokens += cint(getattr(usage, "input_tokens", 0))
        self.output_tokens += cint(getattr(usage, "output_tokens", 0))
        self.cache_read_tokens += cint(getattr(usage, "cache_read_input_tokens", 0))
        self.cache_write_tokens += cint(getattr(usage, "cache_creation_input_tokens", 0))

    @property
    def total_tokens(self):
        return self.input_tokens + self.output_tokens + self.cache_read_tokens + self.cache_write_tokens

    def as_dict(self):
        return {
            "requests": self.requests,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cache_read_tokens": self.cache_read_tokens,
            "cache_write_tokens": self.cache_write_tokens,
            "total_tokens": self.total_tokens,
        }

    def save(self):
        """Write the tally to AI Usage Log. Never raises: a failed log must not lose the answer."""
        if self.rate_limits:
            frappe.cache.set_value(RATE_LIMIT_CACHE_KEY, self.rate_limits)
        if not self.requests:
            return
        try:
            frappe.get_doc(
                {
                    "doctype": "AI Usage Log",
                    "feature": self.feature,
                    "user": frappe.session.user,
                    "model": self.model,
                    **self.as_dict(),
                }
            ).insert(ignore_permissions=True)
        except Exception:
            frappe.log_error(title="Could not record AI usage")


def parse_rate_limits(headers):
    """Pull the anthropic-ratelimit-* headers into {kind: {limit, remaining, reset}}."""
    limits = {}
    for kind, prefix in RATE_LIMIT_HEADERS.items():
        limit = headers.get(f"{prefix}-limit")
        remaining = headers.get(f"{prefix}-remaining")
        if limit is None and remaining is None:
            continue
        limits[kind] = {
            "limit": cint(limit) if limit is not None else None,
            "remaining": cint(remaining) if remaining is not None else None,
            "reset": headers.get(f"{prefix}-reset"),
        }
    if limits:
        limits["as_of"] = frappe.utils.now()
    return limits


def _month_bounds():
    start = getdate(today()).replace(day=1)
    return start, getdate(add_months(start, 1))


def _budget_settings():
    budget = cint(frappe.db.get_single_value("AI Settings", "monthly_token_budget"))
    enforce = cint(frappe.db.get_single_value("AI Settings", "enforce_token_budget"))
    return budget, enforce


def tokens_used_this_month():
    start, next_start = _month_bounds()
    return cint(
        frappe.db.sql(
            """SELECT SUM(total_tokens) FROM `tabAI Usage Log`
            WHERE creation >= %s AND creation < %s""",
            (start, next_start),
        )[0][0]
    )


def check_budget():
    """Stop an AI feature before it calls Claude when the monthly budget is used up."""
    budget, enforce = _budget_settings()
    if not budget or not enforce:
        return
    if tokens_used_this_month() >= budget:
        _, next_start = _month_bounds()
        frappe.throw(
            _(
                "This month's AI token budget of {0} tokens is used up. It resets on {1}, "
                "or an administrator can raise it in AI Settings."
            ).format(frappe.format_value(budget, "Int"), frappe.format_value(next_start, "Date")),
            title=_("Token Budget Reached"),
        )


@frappe.whitelist()
def get_budget_status():
    """This month's token use against the budget, for the assistant's budget meter."""
    frappe.has_permission("Vehicle Inventory", "read", throw=True)

    budget, enforce = _budget_settings()
    start, next_start = _month_bounds()

    rows = frappe.db.sql(
        """SELECT feature,
            COUNT(*) AS actions,
            SUM(requests) AS requests,
            SUM(input_tokens) AS input_tokens,
            SUM(output_tokens) AS output_tokens,
            SUM(cache_read_tokens) AS cache_read_tokens,
            SUM(cache_write_tokens) AS cache_write_tokens,
            SUM(total_tokens) AS total_tokens
        FROM `tabAI Usage Log`
        WHERE creation >= %s AND creation < %s
        GROUP BY feature""",
        (start, next_start),
        as_dict=True,
    )
    by_feature = [
        {k: (cint(v) if k != "feature" else v) for k, v in row.items()} for row in rows
    ]
    used = sum(r["total_tokens"] for r in by_feature)
    totals = {
        key: sum(r[key] for r in by_feature)
        for key in ("input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "requests")
    }

    return {
        "month": start.strftime("%B %Y"),
        "resets_on": str(next_start),
        "budget": budget,
        "enforced": bool(budget and enforce),
        "used": used,
        "remaining": max(budget - used, 0) if budget else None,
        "percent": round(used * 100 / budget, 1) if budget else None,
        "totals": totals,
        "by_feature": by_feature,
        "rate_limits": frappe.cache.get_value(RATE_LIMIT_CACHE_KEY),
        "can_configure": frappe.has_permission("AI Settings", "write"),
    }


def api_error_message(error):
    """The API's own explanation, e.g. "You have reached your specified API usage limits..."."""
    body = error.body if isinstance(error.body, dict) else {}
    return (body.get("error") or {}).get("message") or error.message


def is_spend_limit_error(error):
    """True when Anthropic refused the request because an account spend limit was reached."""
    body = error.body if isinstance(error.body, dict) else {}
    details = (body.get("error") or {}).get("details") or {}
    return details.get("error_code") == "enforced_spend_limit_reached" or "usage limits" in api_error_message(
        error
    )
