import frappe
from frappe.model.document import Document


class AISettings(Document):
    pass


def get_anthropic_credentials():
    """Return (api_key, workspace_id, model) from AI Settings, site config, or environment."""
    import os

    settings = frappe.get_single("AI Settings")

    api_key = (
        settings.get_password("anthropic_api_key", raise_exception=False)
        or frappe.conf.get("anthropic_api_key")
        or os.environ.get("ANTHROPIC_API_KEY")
    )

    workspace_id = (
        settings.get("anthropic_workspace_id")
        or frappe.conf.get("anthropic_workspace_id")
        or os.environ.get("ANTHROPIC_WORKSPACE_ID")
    )

    model = (
        settings.get("anthropic_model")
        or frappe.conf.get("anthropic_model")
        or os.environ.get("ANTHROPIC_MODEL")
    )

    return api_key, workspace_id, model
