"""Remove the lead DocTypes, which Dealerbase no longer uses.

Frappe does not delete a DocType when its files are removed from the app, so
this drops them (and their tables) explicitly. Runs after the model sync, by
which point Vehicle Sale no longer links to Dealer Lead.
"""

import frappe

DOCTYPES = ("Dealer Lead", "Lead Vehicle Interest", "Lead Activity")


def execute():
    for doctype in DOCTYPES:
        if frappe.db.exists("DocType", doctype):
            frappe.delete_doc("DocType", doctype, force=True, ignore_permissions=True)
    frappe.db.commit()
