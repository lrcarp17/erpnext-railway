# Copyright (c) 2024, Dealer Management and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate, getdate


class DealerLead(Document):
	def before_insert(self):
		self.set_lead_id()

	def set_lead_id(self):
		if not self.lead_id:
			year = getdate(nowdate()).year
			prefix = f"LD-{year}-"

			last_lead = frappe.db.sql(
				"""
				SELECT lead_id FROM `tabDealer Lead`
				WHERE lead_id LIKE %s
				ORDER BY lead_id DESC
				LIMIT 1
			""",
				(f"{prefix}%",),
				as_dict=True,
			)

			if last_lead and last_lead[0].lead_id:
				last_number = int(last_lead[0].lead_id.split("-")[-1])
				new_number = last_number + 1
			else:
				new_number = 1

			self.lead_id = f"{prefix}{str(new_number).zfill(5)}"

	def validate(self):
		self.validate_status_transition()
		self.validate_lost_fields()
		self.set_full_name()

	def validate_status_transition(self):
		if self.status == "Sold" and not self.converted_sale:
			frappe.msgprint(
				"Consider linking the converted sale when marking lead as Sold",
				indicator="yellow",
			)

	def validate_lost_fields(self):
		if self.status == "Lost" and not self.lost_reason:
			frappe.throw("Please select a Lost Reason when marking lead as Lost")

	def set_full_name(self):
		self.full_name = f"{self.first_name} {self.last_name}".strip()

	def get_full_name(self):
		return f"{self.first_name} {self.last_name}".strip()
