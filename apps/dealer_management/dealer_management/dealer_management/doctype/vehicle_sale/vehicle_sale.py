# Copyright (c) 2024, Dealer Management and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class VehicleSale(Document):
    def validate(self):
        self.calculate_total_deal_amount()
        self.calculate_profitability()

    def calculate_total_deal_amount(self):
        """Calculate total deal amount including all fees and taxes."""
        total = flt(self.sale_price)
        total += flt(self.doc_fee)
        total += flt(self.registration_fee)
        total += flt(self.sales_tax)
        total += flt(self.other_fees)
        total -= flt(self.trade_in_allowance)
        
        self.total_deal_amount = total

    def calculate_profitability(self):
        """Calculate gross profit, net profit, and profit margin."""
        if not self.vehicle:
            return
            
        vehicle = frappe.get_doc("Vehicle Inventory", self.vehicle)
        total_investment = flt(vehicle.total_investment) if vehicle.total_investment else 0
        
        self.gross_profit = flt(self.sale_price) - total_investment
        
        self.net_profit = self.gross_profit + flt(self.finance_reserve) + flt(self.doc_fee)
        
        if total_investment > 0:
            self.profit_margin = (self.gross_profit / total_investment) * 100
        else:
            self.profit_margin = 0

    def on_submit(self):
        """Update Vehicle status to Sold and set sale_date on submit."""
        if self.vehicle:
            vehicle = frappe.get_doc("Vehicle Inventory", self.vehicle)
            vehicle.db_set("status", "Sold", update_modified=True)
            vehicle.db_set("sale_date", self.sale_date, update_modified=False)
            vehicle.db_set("sale", self.name, update_modified=False)
            
            if self.lead:
                lead = frappe.get_doc("Dealer Lead", self.lead)
                if hasattr(lead, "status"):
                    lead.db_set("status", "Sold", update_modified=True)
                if hasattr(lead, "converted_sale"):
                    lead.db_set("converted_sale", self.name, update_modified=False)

    def on_cancel(self):
        """Revert Vehicle status on cancel."""
        if self.vehicle:
            vehicle = frappe.get_doc("Vehicle Inventory", self.vehicle)
            vehicle.db_set("status", "Available", update_modified=True)
            vehicle.db_set("sale_date", None, update_modified=False)
            vehicle.db_set("sale", None, update_modified=False)
