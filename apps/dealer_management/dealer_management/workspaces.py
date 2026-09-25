"""Trim the desk down to what a Dealerbase deployment uses.

Frappe and ERPNext ship dozens of workspaces and desktop icons (Accounting,
Stock, Manufacturing, CRM, ...). Dealerbase uses none of them, so after every
migrate (which re-syncs the stock ones) this module:

- keeps the Dealerbase workspace and app icon for everyone;
- keeps Frappe's admin tools (the "Framework" folder: Users, System, Email,
  Data import, Printing, Integrations, Automation, Build) for System Managers;
- hides every other workspace and icon, and restricts them to System Managers,
  so other users cannot open them even by URL. Administrators can still reach
  them from the hidden icons on the desktop.

To show everything again, set `dealerbase_show_all_workspaces` to 1 in the site
config (bench --site <site> set-config dealerbase_show_all_workspaces 1) and run
bench migrate, or call restore_all_workspaces().
"""

import json

import frappe

APP = "dealer_management"
ADMIN_ROLE = "System Manager"

# Frappe's admin tools. The desktop shows a child icon only when its parent is
# visible, so restricting the folder covers everything in it.
ADMIN_ICONS = {"Framework"}
ADMIN_WORKSPACES = {"Build", "Users", "Integrations"}

# Icons under Framework that a dealership does not need.
HIDDEN_ADMIN_ICONS = {"Website"}

STATE_KEY = "dealerbase_workspace_changes"


def apply_workspace_policy():
    """Called after install, after every migrate and after the setup wizard."""
    try:
        if frappe.conf.get("dealerbase_show_all_workspaces"):
            restore_all_workspaces()
        else:
            hide_unused_workspaces()
        frappe.db.commit()
    except Exception:
        # Never block a migrate over desk cosmetics.
        frappe.log_error(title="Dealerbase: could not apply the workspace policy")


def hide_unused_workspaces():
    state = _load_state()
    keep_workspaces = set(_our_workspaces())

    for ws in frappe.get_all("Workspace", fields=["name", "is_hidden"]):
        if ws.name in keep_workspaces:
            continue
        _restrict("Workspace", ws.name, state)
        if ws.name not in ADMIN_WORKSPACES:
            _set_flag("Workspace", ws.name, "is_hidden", ws.is_hidden, state)

    keep_icons = set(_our_icons())
    for icon in frappe.get_all("Desktop Icon", fields=["name", "label", "hidden", "parent_icon"]):
        if icon.name in keep_icons:
            continue
        if icon.label in ADMIN_ICONS:
            _restrict("Desktop Icon", icon.name, state)
            continue
        if icon.parent_icon in ADMIN_ICONS and icon.label not in HIDDEN_ADMIN_ICONS:
            # Visible to whoever can see the Framework folder.
            continue
        _restrict("Desktop Icon", icon.name, state)
        _set_flag("Desktop Icon", icon.name, "hidden", icon.hidden, state)

    _save_state(state)
    _clear_desk_caches()


def restore_all_workspaces():
    """Undo hide_unused_workspaces: put back each flag and role it changed."""
    state = _load_state()
    for key, change in state.items():
        doctype, name = key.split("::", 1)
        if not frappe.db.exists(doctype, name):
            continue
        if "flag" in change:
            frappe.db.set_value(doctype, name, change["flag"], change["was"], update_modified=False)
        if change.get("role_added"):
            frappe.db.delete(
                "Has Role", {"parenttype": doctype, "parent": name, "role": ADMIN_ROLE, "parentfield": "roles"}
            )
    _save_state({})
    _clear_desk_caches()


def _our_workspaces():
    modules = frappe.get_all("Module Def", filters={"app_name": APP}, pluck="name")
    return frappe.get_all(
        "Workspace", or_filters={"module": ["in", modules or [""]], "app": APP}, pluck="name"
    )


def _our_icons():
    """The Dealerbase app icon and every icon inside it or pointing at our workspaces."""
    app_title = (frappe.get_hooks("app_title", app_name=APP) or [None])[0]
    screen = frappe.get_hooks("add_to_apps_screen", app_name=APP) or [{}]
    labels = {app_title, screen[0].get("title"), *_our_workspaces()} - {None}

    parents = frappe.get_all("Desktop Icon", or_filters={"app": APP, "label": ["in", list(labels)]}, pluck="name")
    children = frappe.get_all("Desktop Icon", filters={"parent_icon": ["in", parents or [""]]}, pluck="name")
    return parents + children


def _restrict(doctype, name, state):
    """Limit a workspace or icon to System Managers, unless it already has roles."""
    if frappe.db.exists("Has Role", {"parenttype": doctype, "parent": name, "parentfield": "roles"}):
        return
    frappe.get_doc(
        {
            "doctype": "Has Role",
            "parenttype": doctype,
            "parent": name,
            "parentfield": "roles",
            "role": ADMIN_ROLE,
            "idx": 1,
        }
    ).db_insert()
    state.setdefault(f"{doctype}::{name}", {})["role_added"] = True


def _set_flag(doctype, name, field, current, state):
    if current:
        return
    frappe.db.set_value(doctype, name, field, 1, update_modified=False)
    state.setdefault(f"{doctype}::{name}", {}).update({"flag": field, "was": 0})


def _load_state():
    raw = frappe.db.get_default(STATE_KEY)
    return json.loads(raw) if raw else {}


def _save_state(state):
    frappe.db.set_default(STATE_KEY, json.dumps(state))


def _clear_desk_caches():
    frappe.cache.delete_key("desktop_icons")
    frappe.cache.delete_key("bootinfo")
    frappe.clear_cache()
