# Copyright (c) 2024, Dealer Management and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class VehicleCondition(Document):
    def validate(self):
        self.calculate_overall_rating()

    def calculate_overall_rating(self):
        """Calculate overall rating as average of the 4 individual ratings."""
        ratings = []
        
        if self.exterior_rating:
            ratings.append(flt(self.exterior_rating))
        if self.interior_rating:
            ratings.append(flt(self.interior_rating))
        if self.mechanical_rating:
            ratings.append(flt(self.mechanical_rating))
        if self.tire_rating:
            ratings.append(flt(self.tire_rating))
        
        if ratings:
            self.overall_rating = sum(ratings) / len(ratings)
        else:
            self.overall_rating = 0

    def on_update(self):
        """Update linked vehicle's condition reference if not already set."""
        if self.vehicle:
            vehicle = frappe.get_doc("Vehicle Inventory", self.vehicle)
            if not vehicle.condition or vehicle.condition != self.name:
                vehicle.db_set("condition", self.name, update_modified=False)
