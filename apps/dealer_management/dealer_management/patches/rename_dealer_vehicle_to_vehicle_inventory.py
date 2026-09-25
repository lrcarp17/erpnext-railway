"""Rename the Dealer Vehicle DocType to Vehicle Inventory.

Runs before the model sync so the existing table, its records and every link
to them (Vehicle Sale, Dealer Lead, workspaces, charts, ...) are carried over
instead of a new, empty Vehicle Inventory table being created alongside.
"""

import frappe

OLD = "Dealer Vehicle"
NEW = "Vehicle Inventory"


def execute():
    if not frappe.db.exists("DocType", OLD) or frappe.db.exists("DocType", NEW):
        return
    frappe.rename_doc("DocType", OLD, NEW, force=True)
    frappe.db.commit()
