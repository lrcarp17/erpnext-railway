import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt, getdate, now_datetime, date_diff, today
import re


class DealerVehicle(Document):
    def validate(self):
        self.validate_vin()
        self.calculate_days_on_lot()
        self.calculate_total_expenses()
        self.calculate_total_investment()
        self.calculate_potential_profit()
        self.set_note_added_by()

    def before_insert(self):
        self.generate_vehicle_id()
        self.generate_stock_number()

    def validate_vin(self):
        """Validate VIN format: 17 characters, no I, O, Q."""
        if not self.vin:
            frappe.throw(_("VIN is required"))

        vin = self.vin.upper().strip()
        self.vin = vin

        if len(vin) != 17:
            frappe.throw(
                _("VIN must be exactly 17 characters. Current length: {0}").format(
                    len(vin)
                )
            )

        invalid_chars = set("IOQ")
        found_invalid = [char for char in vin if char in invalid_chars]
        if found_invalid:
            frappe.throw(
                _("VIN cannot contain letters I, O, or Q. Found: {0}").format(
                    ", ".join(found_invalid)
                )
            )

        valid_pattern = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")
        if not valid_pattern.match(vin):
            frappe.throw(
                _("VIN contains invalid characters. Only alphanumeric characters (except I, O, Q) are allowed.")
            )

    def generate_vehicle_id(self):
        """Auto-generate vehicle_id on insert (format: VH-{YYYY}-{#####})."""
        if self.vehicle_id:
            return

        current_year = now_datetime().year
        prefix = f"VH-{current_year}-"

        last_vehicle = frappe.db.sql(
            """
            SELECT vehicle_id FROM `tabDealer Vehicle`
            WHERE vehicle_id LIKE %s
            ORDER BY vehicle_id DESC
            LIMIT 1
        """,
            (f"{prefix}%",),
            as_dict=True,
        )

        if last_vehicle:
            last_id = last_vehicle[0].vehicle_id
            last_number = cint(last_id.split("-")[-1])
            next_number = last_number + 1
        else:
            next_number = 1

        self.vehicle_id = f"{prefix}{next_number:05d}"

    def generate_stock_number(self):
        """Auto-generate stock_number on insert if not provided."""
        if self.stock_number:
            return

        last_stock = frappe.db.sql(
            """
            SELECT stock_number FROM `tabDealer Vehicle`
            WHERE stock_number REGEXP '^[0-9]+$'
            ORDER BY CAST(stock_number AS UNSIGNED) DESC
            LIMIT 1
            """,
            as_dict=True,
        )

        if last_stock and last_stock[0].stock_number:
            next_number = cint(last_stock[0].stock_number) + 1
        else:
            next_number = 1001

        self.stock_number = str(next_number)

    def calculate_days_on_lot(self):
        """Calculate days_on_lot from lot_date."""
        if self.lot_date:
            lot_date = getdate(self.lot_date)
            current_date = getdate(today())
            self.days_on_lot = max(0, date_diff(current_date, lot_date))
        else:
            self.days_on_lot = 0

    def calculate_total_expenses(self):
        """Calculate total_expenses from the expenses child table."""
        total = 0.0
        for expense in self.expenses or []:
            total += flt(expense.amount)
        self.total_expenses = total

    def calculate_total_investment(self):
        """Calculate total_investment from acquisition cost + expenses."""
        total = flt(self.total_expenses)

        if self.acquisition:
            acquisition_doc = frappe.get_doc("Vehicle Acquisition", self.acquisition)
            if hasattr(acquisition_doc, "bid_amount"):
                total += flt(acquisition_doc.bid_amount)
            if hasattr(acquisition_doc, "buyer_fee"):
                total += flt(acquisition_doc.buyer_fee)
            if hasattr(acquisition_doc, "transport_cost"):
                total += flt(acquisition_doc.transport_cost)
            if hasattr(acquisition_doc, "title_fee"):
                total += flt(acquisition_doc.title_fee)
            if hasattr(acquisition_doc, "other_fees"):
                total += flt(acquisition_doc.other_fees)

        self.total_investment = total

    def calculate_potential_profit(self):
        """Calculate potential_profit from asking_price - total_investment."""
        self.potential_profit = flt(self.asking_price) - flt(self.total_investment)

    def set_note_added_by(self):
        """Set the added_by field for new notes."""
        for note in self.notes or []:
            if not note.added_by:
                note.added_by = frappe.session.user

    def on_update(self):
        self.update_status_on_sale()

    def update_status_on_sale(self):
        """Update status and sale_date when linked to a sale."""
        if self.sale and self.status != "Sold":
            sale_doc = frappe.get_doc("Vehicle Sale", self.sale)
            if hasattr(sale_doc, "sale_date") and sale_doc.sale_date:
                self.db_set("sale_date", sale_doc.sale_date)
                self.db_set("status", "Sold")


def get_vehicle_summary(vehicle_name):
    """Get a summary of the vehicle for display."""
    vehicle = frappe.get_doc("Dealer Vehicle", vehicle_name)
    return {
        "vehicle_id": vehicle.vehicle_id,
        "vin": vehicle.vin,
        "year_make_model": f"{vehicle.year} {vehicle.make} {vehicle.model}",
        "status": vehicle.status,
        "asking_price": vehicle.asking_price,
        "days_on_lot": vehicle.days_on_lot,
        "potential_profit": vehicle.potential_profit,
    }


@frappe.whitelist()
def decode_vin(vin):
    """Placeholder for VIN decoding functionality."""
    return {
        "vin": vin,
        "message": "VIN decoding requires integration with a VIN decoder service",
    }


@frappe.whitelist()
def get_vehicle_warnings(vehicle_name):
    """Get a list of warnings/alerts for a vehicle."""
    doc = frappe.get_doc("Dealer Vehicle", vehicle_name)
    warnings = []

    if not doc.title_received:
        warnings.append({
            "type": "warning",
            "icon": "file",
            "message": "Title not received"
        })

    if not doc.photos or len(doc.photos) == 0:
        warnings.append({
            "type": "warning", 
            "icon": "camera",
            "message": "No photos uploaded"
        })

    if not doc.acquisition:
        warnings.append({
            "type": "danger",
            "icon": "dollar-sign",
            "message": "No acquisition record (missing purchase price)"
        })
    else:
        acq = frappe.get_doc("Vehicle Acquisition", doc.acquisition)
        if not flt(acq.bid_amount):
            warnings.append({
                "type": "danger",
                "icon": "dollar-sign", 
                "message": "Purchase price not set"
            })

    if not doc.asking_price:
        warnings.append({
            "type": "info",
            "icon": "tag",
            "message": "Asking price not set"
        })

    if doc.has_lien and not doc.lien_release_received:
        warnings.append({
            "type": "warning",
            "icon": "link",
            "message": "Lien release not received"
        })

    if doc.status in ("Frontline", "Available") and len(doc.photos or []) < 5:
        warnings.append({
            "type": "info",
            "icon": "camera",
            "message": f"Only {len(doc.photos or [])} photos - consider adding more"
        })

    return warnings


@frappe.whitelist()
def upload_vehicle_photos(vehicle_name, files):
    """Upload multiple photos to a vehicle."""
    import json
    
    frappe.has_permission("Dealer Vehicle", "write", throw=True)
    
    files = json.loads(files) if isinstance(files, str) else files
    doc = frappe.get_doc("Dealer Vehicle", vehicle_name)
    
    for file_url in files:
        doc.append("photos", {
            "photo": file_url,
            "photo_type": "Exterior",
        })
    
    doc.save()
    return {"success": True, "count": len(files)}
