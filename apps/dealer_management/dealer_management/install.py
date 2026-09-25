"""Dealerbase branding and landing page.

Applied after install, after every migrate (each deploy of a changed image runs
one) and when the setup wizard finishes, which resets the home page. The same
points apply the workspace policy in workspaces.py. Settings an
administrator has already customised are left alone.
"""

import frappe

from dealer_management.workspaces import apply_workspace_policy

APP_NAME = "dealer_management"
BRAND_NAME = "Dealerbase"
LOGO_URL = "/assets/dealer_management/images/dealerbase-logo.svg"
FAVICON_URL = "/assets/dealer_management/images/favicon.svg"
HOME_PAGE = "dealer-home"

# Values Frappe/ERPNext ship with, which are safe to replace with ours.
STOCK_APP_NAMES = {None, "", "Frappe", "ERPNext", "Frappe Framework"}
STOCK_HOME_PAGES = {None, "", "workspace", "desktop", "Workspaces"}


def before_install():
    pass


def after_install():
    apply_branding()
    apply_workspace_policy()


def after_migrate():
    apply_branding()
    apply_workspace_policy()


def after_setup_wizard(args=None):
    apply_branding()
    apply_workspace_policy()


def apply_branding():
    try:
        set_home_page()
        set_single_if_stock("System Settings", "app_name", BRAND_NAME, STOCK_APP_NAMES)
        # With ERPNext installed too, signing in lands on the desktop of app icons;
        # make Dealerbase the default app so it opens the Dealerbase home instead.
        set_single_if_stock("System Settings", "default_app", APP_NAME, {None, ""})
        set_single_if_stock("Website Settings", "app_name", BRAND_NAME, STOCK_APP_NAMES)
        set_single_if_stock("Navbar Settings", "app_logo", LOGO_URL, {None, ""})
        set_single_if_stock("Website Settings", "app_logo", LOGO_URL, {None, ""})
        set_single_if_stock("Website Settings", "favicon", FAVICON_URL, {None, ""})
        frappe.db.commit()
        frappe.clear_cache()
    except Exception:
        # Branding must never block a migrate or the setup wizard.
        frappe.log_error(title="Dealerbase: could not apply branding")


def set_home_page():
    # Until setup is complete the home page is the setup wizard; leave it there.
    current = frappe.db.get_default("desktop:home_page")
    if current == "setup-wizard" or not frappe.db.exists("Page", HOME_PAGE):
        return
    if current in STOCK_HOME_PAGES:
        frappe.db.set_default("desktop:home_page", HOME_PAGE)


def set_single_if_stock(doctype, field, value, stock_values):
    if not frappe.db.exists("DocType", doctype):
        return
    meta = frappe.get_meta(doctype)
    if not meta.has_field(field):
        return
    if frappe.db.get_single_value(doctype, field) in stock_values:
        frappe.db.set_single_value(doctype, field, value)
