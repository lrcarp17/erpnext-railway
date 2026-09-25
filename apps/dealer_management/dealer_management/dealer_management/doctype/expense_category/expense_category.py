# Copyright (c) 2024, Dealer Management and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ExpenseCategory(Document):
	def validate(self):
		self.validate_parent_category()

	def validate_parent_category(self):
		if self.parent_category:
			if self.parent_category == self.name:
				frappe.throw("Parent Category cannot be the same as the Category itself")

			parent = frappe.get_doc("Expense Category", self.parent_category)
			if parent.parent_category == self.name:
				frappe.throw("Circular reference detected in Parent Category")
