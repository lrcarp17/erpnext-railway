# Copyright (c) 2024, Dealer Management and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class VehicleAcquisition(Document):
    def validate(self):
        self.calculate_total_acquisition_cost()
        self.calculate_total_estimated_turnover()

    def calculate_total_acquisition_cost(self):
        """Calculate total acquisition cost including all fees and lien payoff."""
        total = flt(self.bid_amount)
        total += flt(self.buyer_fee)
        total += flt(self.transport_cost)
        total += flt(self.title_fee)
        total += flt(self.other_fees)
        
        if self.had_existing_lien:
            total += flt(self.lien_payoff_amount)
        
        self.total_acquisition_cost = total

    def calculate_total_estimated_turnover(self):
        """Calculate total estimated turnover costs."""
        total = flt(self.estimated_recon)
        total += flt(self.estimated_repairs)
        total += flt(self.estimated_detail)
        
        self.total_estimated_turnover = total

    def on_update(self):
        """Update linked vehicle's acquisition reference if not already set."""
        if self.vehicle:
            vehicle = frappe.get_doc("Dealer Vehicle", self.vehicle)
            if not vehicle.acquisition or vehicle.acquisition != self.name:
                vehicle.db_set("acquisition", self.name, update_modified=False)
                vehicle.db_set("acquisition_date", self.purchase_date, update_modified=False)
