# Copyright (c) 2024, Dealer Management and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class VehicleMarketInfo(Document):
    def on_update(self):
        """Update linked vehicle's market_info reference if not already set."""
        if self.vehicle:
            vehicle = frappe.get_doc("Dealer Vehicle", self.vehicle)
            if not vehicle.market_info or vehicle.market_info != self.name:
                vehicle.db_set("market_info", self.name, update_modified=False)
                
                if self.retail_value:
                    vehicle.db_set("book_value", self.retail_value, update_modified=False)
