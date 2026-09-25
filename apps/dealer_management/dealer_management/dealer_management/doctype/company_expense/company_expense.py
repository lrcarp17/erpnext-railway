# Copyright (c) 2024, Dealer Management and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate


class CompanyExpense(Document):
	def before_insert(self):
		self.set_expense_id()

	def set_expense_id(self):
		if not self.expense_id:
			expense_date = getdate(self.expense_date)
			year = expense_date.year
			month = str(expense_date.month).zfill(2)

			prefix = f"EXP-{year}-{month}-"

			last_expense = frappe.db.sql(
				"""
				SELECT expense_id FROM `tabCompany Expense`
				WHERE expense_id LIKE %s
				ORDER BY expense_id DESC
				LIMIT 1
			""",
				(f"{prefix}%",),
				as_dict=True,
			)

			if last_expense and last_expense[0].expense_id:
				last_number = int(last_expense[0].expense_id.split("-")[-1])
				new_number = last_number + 1
			else:
				new_number = 1

			self.expense_id = f"{prefix}{str(new_number).zfill(5)}"

	def validate(self):
		self.validate_category()
		self.validate_recurrence()

	def validate_category(self):
		if self.category:
			category = frappe.get_doc("Expense Category", self.category)
			if category.expense_type == "Vehicle":
				frappe.throw(
					"This category is for Vehicle expenses only. Please select a Company or Both category."
				)

	def validate_recurrence(self):
		if self.is_recurring and not self.recurrence:
			frappe.throw("Please select a Recurrence type for recurring expenses")
