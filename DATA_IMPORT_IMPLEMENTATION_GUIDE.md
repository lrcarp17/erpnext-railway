# Data Import Implementation Guide

This document provides technical specifications for implementing the priority data import features identified in the UX evaluation.

---

## 1. Bulk Vehicle Import

### Overview

A CSV/Excel import wizard for batch-loading vehicles, designed for dealers migrating from spreadsheets or other systems.

### File: `dealer_management/bulk_import/vehicle_import.py`

```python
"""Bulk vehicle import from CSV/Excel files."""

import csv
import io
import re
from typing import Any

import frappe
from frappe import _
from frappe.utils import cint, flt, getdate

# Field mapping: CSV column name variations → Dealer Vehicle fieldname
COLUMN_ALIASES = {
    "vin": ["vin", "vehicle_vin", "vin_number", "vehicle identification number"],
    "year": ["year", "model_year", "yr"],
    "make": ["make", "manufacturer", "brand"],
    "model": ["model", "vehicle_model"],
    "trim": ["trim", "trim_level", "package"],
    "stock_number": ["stock", "stock_number", "stock_no", "stk"],
    "mileage_in": ["mileage", "miles", "odometer", "odo"],
    "exterior_color": ["color", "exterior_color", "ext_color", "exterior"],
    "interior_color": ["interior", "interior_color", "int_color"],
    "asking_price": ["asking", "asking_price", "price", "list_price", "retail"],
    "floor_price": ["floor", "floor_price", "minimum", "min_price"],
    "acquisition_date": ["acquired", "acquisition_date", "purchase_date", "bought"],
    "title_status": ["title_status", "title_type", "title"],
    "status": ["status", "vehicle_status", "inv_status"],
    "notes": ["notes", "comments", "description"],
}

REQUIRED_FIELDS = ["vin", "year", "make", "model"]

VIN_PATTERN = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")


@frappe.whitelist()
def parse_import_file(file_url: str) -> dict:
    """
    Parse an uploaded CSV/Excel file and return column headers + sample data.
    
    Args:
        file_url: URL of the uploaded file
        
    Returns:
        dict with headers, sample_rows, detected_mapping, and row_count
    """
    frappe.has_permission("Dealer Vehicle", "create", throw=True)
    
    content, filename = _get_file_content(file_url)
    
    if filename.lower().endswith((".xlsx", ".xls")):
        rows = _parse_excel(content)
    else:
        rows = _parse_csv(content)
    
    if not rows:
        frappe.throw(_("The file is empty or could not be parsed."))
    
    headers = rows[0]
    data_rows = rows[1:]
    
    # Auto-detect column mapping
    detected_mapping = {}
    for i, header in enumerate(headers):
        header_lower = header.lower().strip()
        for field, aliases in COLUMN_ALIASES.items():
            if header_lower in aliases:
                detected_mapping[header] = field
                break
    
    return {
        "headers": headers,
        "sample_rows": data_rows[:5],  # Preview first 5 rows
        "detected_mapping": detected_mapping,
        "row_count": len(data_rows),
    }


@frappe.whitelist()
def validate_import(file_url: str, column_mapping: str) -> dict:
    """
    Validate all rows against the mapping and return validation results.
    
    Args:
        file_url: URL of the uploaded file
        column_mapping: JSON dict mapping file columns to Dealer Vehicle fields
        
    Returns:
        dict with valid_count, warning_count, error_count, and details
    """
    frappe.has_permission("Dealer Vehicle", "create", throw=True)
    
    column_mapping = frappe.parse_json(column_mapping)
    content, filename = _get_file_content(file_url)
    
    if filename.lower().endswith((".xlsx", ".xls")):
        rows = _parse_excel(content)
    else:
        rows = _parse_csv(content)
    
    headers = rows[0]
    data_rows = rows[1:]
    
    results = {
        "valid": [],
        "warnings": [],
        "errors": [],
    }
    
    existing_vins = set(
        frappe.get_all("Dealer Vehicle", pluck="vin")
    )
    import_vins = set()
    
    for row_num, row in enumerate(data_rows, start=2):
        row_data = dict(zip(headers, row))
        mapped_data = _apply_mapping(row_data, column_mapping)
        
        validation = _validate_row(mapped_data, row_num, existing_vins, import_vins)
        
        if validation["status"] == "error":
            results["errors"].append(validation)
        elif validation["status"] == "warning":
            results["warnings"].append(validation)
            import_vins.add(mapped_data.get("vin", "").upper())
        else:
            results["valid"].append(validation)
            import_vins.add(mapped_data.get("vin", "").upper())
    
    return {
        "valid_count": len(results["valid"]),
        "warning_count": len(results["warnings"]),
        "error_count": len(results["errors"]),
        "valid_rows": results["valid"][:100],  # Limit response size
        "warning_rows": results["warnings"],
        "error_rows": results["errors"],
    }


@frappe.whitelist()
def execute_import(file_url: str, column_mapping: str, skip_errors: bool = True) -> dict:
    """
    Execute the import, creating Dealer Vehicle records.
    
    Args:
        file_url: URL of the uploaded file
        column_mapping: JSON dict mapping file columns to Dealer Vehicle fields
        skip_errors: If True, skip rows with errors; if False, stop on first error
        
    Returns:
        dict with imported_count, skipped_count, and details
    """
    frappe.has_permission("Dealer Vehicle", "create", throw=True)
    
    column_mapping = frappe.parse_json(column_mapping)
    content, filename = _get_file_content(file_url)
    
    if filename.lower().endswith((".xlsx", ".xls")):
        rows = _parse_excel(content)
    else:
        rows = _parse_csv(content)
    
    headers = rows[0]
    data_rows = rows[1:]
    
    imported = []
    skipped = []
    
    existing_vins = set(frappe.get_all("Dealer Vehicle", pluck="vin"))
    
    for row_num, row in enumerate(data_rows, start=2):
        row_data = dict(zip(headers, row))
        mapped_data = _apply_mapping(row_data, column_mapping)
        
        # Skip if missing required fields
        missing = [f for f in REQUIRED_FIELDS if not mapped_data.get(f)]
        if missing:
            skipped.append({"row": row_num, "reason": f"Missing: {', '.join(missing)}"})
            continue
        
        vin = mapped_data.get("vin", "").upper().strip()
        
        # Skip duplicates
        if vin in existing_vins:
            skipped.append({"row": row_num, "reason": f"Duplicate VIN: {vin}"})
            continue
        
        try:
            vehicle = _create_vehicle(mapped_data)
            imported.append({
                "row": row_num,
                "vehicle": vehicle.name,
                "label": f"{vehicle.year} {vehicle.make} {vehicle.model}",
            })
            existing_vins.add(vin)
        except Exception as e:
            if skip_errors:
                skipped.append({"row": row_num, "reason": str(e)})
            else:
                frappe.throw(_(f"Error on row {row_num}: {e}"))
    
    frappe.db.commit()
    
    return {
        "imported_count": len(imported),
        "skipped_count": len(skipped),
        "imported": imported[:50],  # Limit response size
        "skipped": skipped,
    }


def _get_file_content(file_url: str) -> tuple[bytes, str]:
    """Get file content and filename from file URL."""
    file_doc = frappe.get_doc("File", {"file_url": file_url})
    file_doc.check_permission("read")
    return file_doc.get_content(), file_doc.file_name or file_url


def _parse_csv(content: bytes) -> list[list[str]]:
    """Parse CSV content into rows."""
    text = content.decode("utf-8-sig")  # Handle BOM
    reader = csv.reader(io.StringIO(text))
    return list(reader)


def _parse_excel(content: bytes) -> list[list[str]]:
    """Parse Excel content into rows."""
    import openpyxl
    
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    
    rows = []
    for row in ws.iter_rows(values_only=True):
        rows.append([str(cell) if cell is not None else "" for cell in row])
    
    return rows


def _apply_mapping(row_data: dict, column_mapping: dict) -> dict:
    """Apply column mapping to convert file columns to vehicle fields."""
    result = {}
    for file_col, vehicle_field in column_mapping.items():
        if file_col in row_data and vehicle_field:
            result[vehicle_field] = row_data[file_col]
    return result


def _validate_row(data: dict, row_num: int, existing_vins: set, import_vins: set) -> dict:
    """Validate a single row of data."""
    issues = []
    
    # Check required fields
    missing = [f for f in REQUIRED_FIELDS if not data.get(f)]
    if missing:
        return {
            "status": "error",
            "row": row_num,
            "message": f"Missing required fields: {', '.join(missing)}",
            "data": data,
        }
    
    # Validate VIN
    vin = data.get("vin", "").upper().strip()
    if not VIN_PATTERN.match(vin):
        return {
            "status": "error",
            "row": row_num,
            "message": f"Invalid VIN format: {vin}",
            "data": data,
        }
    
    # Check for duplicates
    if vin in existing_vins:
        return {
            "status": "warning",
            "row": row_num,
            "message": f"VIN already exists in system: {vin}",
            "data": data,
        }
    
    if vin in import_vins:
        return {
            "status": "warning",
            "row": row_num,
            "message": f"Duplicate VIN in this import file: {vin}",
            "data": data,
        }
    
    # Validate year
    year = cint(data.get("year"))
    if year < 1900 or year > 2030:
        issues.append(f"Unusual year: {year}")
    
    return {
        "status": "warning" if issues else "valid",
        "row": row_num,
        "message": "; ".join(issues) if issues else "OK",
        "data": data,
    }


def _create_vehicle(data: dict) -> "frappe.model.document.Document":
    """Create a Dealer Vehicle from mapped data."""
    vehicle = frappe.new_doc("Dealer Vehicle")
    
    # Direct field mapping
    field_map = {
        "vin": "vin",
        "year": "year",
        "make": "make",
        "model": "model",
        "trim": "trim",
        "stock_number": "stock_number",
        "exterior_color": "exterior_color",
        "interior_color": "interior_color",
        "asking_price": "asking_price",
        "floor_price": "floor_price",
        "title_status": "title_status",
        "status": "status",
    }
    
    for source, target in field_map.items():
        if data.get(source):
            vehicle.set(target, data[source])
    
    # Handle mileage
    if data.get("mileage_in"):
        mileage = cint(data["mileage_in"])
        vehicle.mileage_in = mileage
        vehicle.mileage_current = mileage
    
    # Handle dates
    if data.get("acquisition_date"):
        try:
            vehicle.acquisition_date = getdate(data["acquisition_date"])
        except Exception:
            pass
    
    # Handle notes
    if data.get("notes"):
        vehicle.append("notes", {
            "note_type": "General",
            "note": data["notes"],
        })
    
    # Set default status if not provided
    if not vehicle.status:
        vehicle.status = "Pre-Sale"
    
    vehicle.insert()
    return vehicle
```

### Client-Side Import Wizard

```javascript
// dealer_management/public/js/bulk_import.js

frappe.provide("dealer_management.bulk_import");

dealer_management.bulk_import.open_vehicle_import = function() {
    const dialog = new frappe.ui.Dialog({
        title: __("Import Vehicles from CSV/Excel"),
        size: "extra-large",
        fields: [
            {
                fieldname: "step_html",
                fieldtype: "HTML",
            },
            {
                fieldname: "file",
                fieldtype: "Attach",
                label: __("Upload File"),
                options: {
                    restrictions: {
                        allowed_file_types: [".csv", ".xlsx", ".xls"],
                    },
                },
            },
            {
                fieldname: "mapping_section",
                fieldtype: "Section Break",
                label: __("Column Mapping"),
                hidden: 1,
            },
            {
                fieldname: "mapping_html",
                fieldtype: "HTML",
            },
            {
                fieldname: "validation_section",
                fieldtype: "Section Break", 
                label: __("Validation Results"),
                hidden: 1,
            },
            {
                fieldname: "validation_html",
                fieldtype: "HTML",
            },
        ],
        primary_action_label: __("Parse File"),
        primary_action: function() {
            const file_url = dialog.get_value("file");
            if (!file_url) {
                frappe.msgprint(__("Please upload a file first"));
                return;
            }
            parse_file(dialog, file_url);
        },
    });
    
    update_step_indicator(dialog, 1);
    dialog.show();
};

function update_step_indicator(dialog, step) {
    const steps = [
        { num: 1, label: "Upload" },
        { num: 2, label: "Map Columns" },
        { num: 3, label: "Validate" },
        { num: 4, label: "Import" },
    ];
    
    let html = '<div class="import-steps" style="display: flex; gap: 2rem; margin-bottom: 1rem;">';
    steps.forEach(s => {
        const active = s.num === step ? "font-weight: bold; color: var(--primary);" : "color: var(--text-muted);";
        const done = s.num < step ? "✓ " : "";
        html += `<span style="${active}">${done}${s.num}. ${s.label}</span>`;
    });
    html += "</div>";
    
    dialog.fields_dict.step_html.$wrapper.html(html);
}

function parse_file(dialog, file_url) {
    dialog.disable_primary_action();
    
    frappe.call({
        method: "dealer_management.bulk_import.vehicle_import.parse_import_file",
        args: { file_url },
        freeze: true,
        freeze_message: __("Parsing file..."),
        callback: function(r) {
            if (r.message) {
                show_mapping_step(dialog, file_url, r.message);
            }
        },
        always: function() {
            dialog.enable_primary_action();
        },
    });
}

function show_mapping_step(dialog, file_url, parse_result) {
    update_step_indicator(dialog, 2);
    
    dialog.set_df_property("mapping_section", "hidden", 0);
    
    const vehicle_fields = [
        { value: "", label: "-- Skip --" },
        { value: "vin", label: "VIN *" },
        { value: "year", label: "Year *" },
        { value: "make", label: "Make *" },
        { value: "model", label: "Model *" },
        { value: "trim", label: "Trim" },
        { value: "stock_number", label: "Stock Number" },
        { value: "mileage_in", label: "Mileage" },
        { value: "exterior_color", label: "Exterior Color" },
        { value: "interior_color", label: "Interior Color" },
        { value: "asking_price", label: "Asking Price" },
        { value: "floor_price", label: "Floor Price" },
        { value: "acquisition_date", label: "Acquisition Date" },
        { value: "title_status", label: "Title Status" },
        { value: "status", label: "Status" },
        { value: "notes", label: "Notes" },
    ];
    
    let html = '<table class="table table-bordered"><thead><tr>';
    html += '<th>File Column</th><th>Sample Data</th><th>Maps To</th>';
    html += '</tr></thead><tbody>';
    
    parse_result.headers.forEach((header, i) => {
        const sample = parse_result.sample_rows[0] ? parse_result.sample_rows[0][i] : "";
        const detected = parse_result.detected_mapping[header] || "";
        
        const options = vehicle_fields.map(f => 
            `<option value="${f.value}" ${f.value === detected ? "selected" : ""}>${f.label}</option>`
        ).join("");
        
        html += `<tr>
            <td><strong>${frappe.utils.escape_html(header)}</strong></td>
            <td class="text-muted">${frappe.utils.escape_html(sample.substring(0, 50))}</td>
            <td><select class="form-control mapping-select" data-column="${frappe.utils.escape_html(header)}">${options}</select></td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += `<p class="text-muted">${parse_result.row_count} data rows found. * = required field</p>`;
    
    dialog.fields_dict.mapping_html.$wrapper.html(html);
    
    dialog.set_primary_action(__("Validate"), function() {
        const mapping = {};
        dialog.$wrapper.find(".mapping-select").each(function() {
            const col = $(this).data("column");
            const field = $(this).val();
            if (field) mapping[col] = field;
        });
        validate_import(dialog, file_url, mapping);
    });
}

function validate_import(dialog, file_url, mapping) {
    dialog.disable_primary_action();
    
    frappe.call({
        method: "dealer_management.bulk_import.vehicle_import.validate_import",
        args: { 
            file_url,
            column_mapping: JSON.stringify(mapping),
        },
        freeze: true,
        freeze_message: __("Validating..."),
        callback: function(r) {
            if (r.message) {
                show_validation_results(dialog, file_url, mapping, r.message);
            }
        },
        always: function() {
            dialog.enable_primary_action();
        },
    });
}

function show_validation_results(dialog, file_url, mapping, results) {
    update_step_indicator(dialog, 3);
    
    dialog.set_df_property("validation_section", "hidden", 0);
    
    let html = '<div class="validation-summary" style="margin-bottom: 1rem;">';
    html += `<span class="badge badge-success">✓ ${results.valid_count} valid</span> `;
    html += `<span class="badge badge-warning">⚠ ${results.warning_count} warnings</span> `;
    html += `<span class="badge badge-danger">✗ ${results.error_count} errors</span>`;
    html += '</div>';
    
    if (results.error_rows.length > 0) {
        html += '<h6>Errors (will be skipped):</h6><ul class="text-danger">';
        results.error_rows.slice(0, 10).forEach(e => {
            html += `<li>Row ${e.row}: ${frappe.utils.escape_html(e.message)}</li>`;
        });
        if (results.error_rows.length > 10) {
            html += `<li>... and ${results.error_rows.length - 10} more</li>`;
        }
        html += '</ul>';
    }
    
    if (results.warning_rows.length > 0) {
        html += '<h6>Warnings:</h6><ul class="text-warning">';
        results.warning_rows.slice(0, 5).forEach(w => {
            html += `<li>Row ${w.row}: ${frappe.utils.escape_html(w.message)}</li>`;
        });
        if (results.warning_rows.length > 5) {
            html += `<li>... and ${results.warning_rows.length - 5} more</li>`;
        }
        html += '</ul>';
    }
    
    dialog.fields_dict.validation_html.$wrapper.html(html);
    
    const importable = results.valid_count + results.warning_count;
    dialog.set_primary_action(__("Import {0} Vehicles", [importable]), function() {
        execute_import(dialog, file_url, mapping);
    });
}

function execute_import(dialog, file_url, mapping) {
    dialog.disable_primary_action();
    
    frappe.call({
        method: "dealer_management.bulk_import.vehicle_import.execute_import",
        args: {
            file_url,
            column_mapping: JSON.stringify(mapping),
            skip_errors: true,
        },
        freeze: true,
        freeze_message: __("Importing vehicles..."),
        callback: function(r) {
            if (r.message) {
                update_step_indicator(dialog, 4);
                
                let html = '<div class="alert alert-success">';
                html += `<strong>Import Complete!</strong><br>`;
                html += `${r.message.imported_count} vehicles imported successfully.<br>`;
                if (r.message.skipped_count > 0) {
                    html += `${r.message.skipped_count} rows skipped.`;
                }
                html += '</div>';
                
                dialog.fields_dict.validation_html.$wrapper.html(html);
                dialog.set_primary_action(__("Close"), function() {
                    dialog.hide();
                    frappe.set_route("List", "Dealer Vehicle");
                });
            }
        },
        always: function() {
            dialog.enable_primary_action();
        },
    });
}
```

---

## 2. Company Expense Import

### File: `dealer_management/bulk_import/expense_import.py`

```python
"""Import company expenses from bank statements (CSV/OFX)."""

import csv
import io
import re
from datetime import datetime

import frappe
from frappe import _
from frappe.utils import flt, getdate

# Auto-categorization rules
CATEGORY_RULES = [
    {"pattern": r"ALLSTATE|GEICO|PROGRESSIVE|STATE FARM|INSURANCE", "category": "Insurance"},
    {"pattern": r"CARS\.COM|CARGURUS|AUTOTRADER|CARFAX", "category": "Software/Subscriptions"},
    {"pattern": r"FACEBOOK|GOOGLE ADS|YELP|INDEED|LINKEDIN", "category": "Marketing/Advertising"},
    {"pattern": r"PROPERTY|REALTY|LANDLORD|LEASE|RENT", "category": "Rent/Lease"},
    {"pattern": r"AT&T|VERIZON|COMCAST|SPECTRUM|ELECTRIC|WATER|GAS CO", "category": "Utilities"},
    {"pattern": r"OFFICE DEPOT|STAPLES|AMAZON", "category": "Office Supplies"},
    {"pattern": r"ADP|PAYROLL|GUSTO", "category": "Payroll"},
    {"pattern": r"MANHEIM|ADESA|ACV|COPART|IAA|AUCTION", "category": None},  # Vehicle expense, skip
    {"pattern": r"SHELL|CHEVRON|EXXON|BP|GAS", "category": None},  # Skip fuel (often personal)
]


@frappe.whitelist()
def parse_bank_statement(file_url: str) -> dict:
    """
    Parse a bank statement CSV and return transactions with suggested categories.
    
    Supports common CSV formats from Chase, Bank of America, Wells Fargo, etc.
    """
    frappe.has_permission("Company Expense", "create", throw=True)
    
    content, filename = _get_file_content(file_url)
    
    if filename.lower().endswith(".ofx"):
        transactions = _parse_ofx(content)
    else:
        transactions = _parse_bank_csv(content)
    
    # Apply auto-categorization
    categories = {c.name: c.name for c in frappe.get_all("Expense Category", filters={"is_active": 1})}
    
    for txn in transactions:
        txn["suggested_category"] = _suggest_category(txn["description"], categories)
        txn["should_import"] = txn["suggested_category"] is not None
    
    return {
        "transactions": transactions,
        "total_count": len(transactions),
        "expense_count": sum(1 for t in transactions if t["should_import"]),
    }


@frappe.whitelist()
def import_expenses(transactions: str) -> dict:
    """
    Import selected transactions as Company Expenses.
    
    Args:
        transactions: JSON array of transactions with category assignments
    """
    frappe.has_permission("Company Expense", "create", throw=True)
    
    transactions = frappe.parse_json(transactions)
    
    imported = []
    skipped = []
    
    for txn in transactions:
        if not txn.get("category"):
            skipped.append({"description": txn["description"], "reason": "No category"})
            continue
        
        try:
            expense = frappe.new_doc("Company Expense")
            expense.expense_date = getdate(txn["date"])
            expense.category = txn["category"]
            expense.description = txn["description"][:140]
            expense.amount = abs(flt(txn["amount"]))
            expense.vendor = _extract_vendor(txn["description"])
            expense.reference_number = txn.get("reference")
            expense.insert()
            expense.submit()
            
            imported.append({
                "name": expense.name,
                "description": expense.description,
                "amount": expense.amount,
            })
        except Exception as e:
            skipped.append({"description": txn["description"], "reason": str(e)})
    
    frappe.db.commit()
    
    return {
        "imported_count": len(imported),
        "skipped_count": len(skipped),
        "imported": imported,
        "skipped": skipped,
    }


def _get_file_content(file_url: str) -> tuple[bytes, str]:
    """Get file content from URL."""
    file_doc = frappe.get_doc("File", {"file_url": file_url})
    file_doc.check_permission("read")
    return file_doc.get_content(), file_doc.file_name or file_url


def _parse_bank_csv(content: bytes) -> list[dict]:
    """
    Parse bank CSV. Handles multiple formats by detecting columns.
    
    Common formats:
    - Chase: Transaction Date, Post Date, Description, Category, Type, Amount
    - BofA: Date, Description, Amount, Running Bal.
    - Wells: Date, Amount, *, *, Description
    """
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    
    transactions = []
    
    for row in reader:
        # Normalize column names
        row = {k.lower().strip(): v for k, v in row.items()}
        
        # Find date
        date = None
        for col in ["transaction date", "date", "posted date", "post date"]:
            if col in row and row[col]:
                try:
                    date = _parse_date(row[col])
                    break
                except Exception:
                    pass
        
        if not date:
            continue
        
        # Find description
        description = ""
        for col in ["description", "memo", "payee", "name"]:
            if col in row and row[col]:
                description = row[col]
                break
        
        # Find amount
        amount = 0
        for col in ["amount", "debit", "withdrawal"]:
            if col in row and row[col]:
                try:
                    amount = flt(row[col].replace("$", "").replace(",", ""))
                    break
                except Exception:
                    pass
        
        # Only include debits/expenses (negative or positive depending on format)
        if amount >= 0:
            continue
        
        transactions.append({
            "date": str(date),
            "description": description.strip(),
            "amount": amount,
            "reference": row.get("reference", row.get("check number", "")),
        })
    
    return transactions


def _parse_ofx(content: bytes) -> list[dict]:
    """Parse OFX/QFX file format."""
    from ofxparse import OfxParser
    
    ofx = OfxParser.parse(io.BytesIO(content))
    transactions = []
    
    for account in ofx.accounts:
        for txn in account.statement.transactions:
            if txn.amount < 0:  # Only expenses
                transactions.append({
                    "date": str(txn.date.date()),
                    "description": txn.payee or txn.memo or "",
                    "amount": float(txn.amount),
                    "reference": txn.id,
                })
    
    return transactions


def _parse_date(date_str: str) -> datetime.date:
    """Parse date from various formats."""
    formats = [
        "%m/%d/%Y",
        "%m/%d/%y", 
        "%Y-%m-%d",
        "%m-%d-%Y",
        "%d/%m/%Y",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    
    raise ValueError(f"Cannot parse date: {date_str}")


def _suggest_category(description: str, categories: dict) -> str | None:
    """Suggest expense category based on description."""
    desc_upper = description.upper()
    
    for rule in CATEGORY_RULES:
        if re.search(rule["pattern"], desc_upper):
            if rule["category"] and rule["category"] in categories:
                return rule["category"]
            return None  # Explicitly skip
    
    return "Miscellaneous"  # Default


def _extract_vendor(description: str) -> str:
    """Extract vendor name from transaction description."""
    # Remove common prefixes
    vendor = re.sub(r"^(POS|ACH|DEBIT|CHECK|WIRE|EFT)\s*", "", description, flags=re.IGNORECASE)
    # Take first part before special characters
    vendor = re.split(r"[*#\d]{3,}", vendor)[0]
    return vendor.strip()[:100]
```

---

## 3. VIN Decoder Integration

### File: `dealer_management/integrations/vin_decoder.py`

```python
"""VIN decoder integration using NHTSA vPIC API (free)."""

import frappe
from frappe import _
import requests

NHTSA_API = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevin"


@frappe.whitelist()
def decode_vin(vin: str) -> dict:
    """
    Decode a VIN using the NHTSA vPIC API.
    
    Args:
        vin: 17-character Vehicle Identification Number
        
    Returns:
        dict with vehicle specifications
    """
    vin = vin.upper().strip()
    
    if len(vin) != 17:
        frappe.throw(_("VIN must be exactly 17 characters"))
    
    try:
        response = requests.get(
            f"{NHTSA_API}/{vin}",
            params={"format": "json"},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        frappe.throw(_("Could not reach VIN decoder service: {0}").format(str(e)))
    
    # Convert results list to dict
    results = {r["Variable"]: r["Value"] for r in data.get("Results", []) if r["Value"]}
    
    return {
        "vin": vin,
        "year": _safe_int(results.get("Model Year")),
        "make": _title_case(results.get("Make")),
        "model": _title_case(results.get("Model")),
        "trim": results.get("Trim"),
        "body_style": _map_body_style(results.get("Body Class")),
        "engine": _format_engine(results),
        "transmission": _map_transmission(results.get("Transmission Style")),
        "drivetrain": _map_drivetrain(results.get("Drive Type")),
        "fuel_type": _map_fuel_type(results.get("Fuel Type - Primary")),
        "doors": _safe_int(results.get("Doors")),
        "manufacturer": results.get("Manufacturer Name"),
        "plant_city": results.get("Plant City"),
        "plant_country": results.get("Plant Country"),
    }


def _safe_int(value):
    """Convert to int, returning None on failure."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _title_case(value):
    """Convert to title case if string."""
    if value:
        return str(value).title()
    return None


def _format_engine(results: dict) -> str | None:
    """Format engine description from NHTSA fields."""
    parts = []
    
    displacement = results.get("Displacement (L)")
    if displacement:
        parts.append(f"{displacement}L")
    
    cylinders = results.get("Engine Number of Cylinders")
    config = results.get("Engine Configuration")
    if cylinders and config:
        parts.append(f"{config}{cylinders}")
    elif cylinders:
        parts.append(f"{cylinders}-Cyl")
    
    if parts:
        return " ".join(parts)
    return None


def _map_body_style(nhtsa_value: str | None) -> str | None:
    """Map NHTSA body class to Dealer Vehicle body_style options."""
    if not nhtsa_value:
        return None
    
    mapping = {
        "sedan": "Sedan",
        "coupe": "Coupe",
        "convertible": "Convertible",
        "wagon": "Wagon",
        "hatchback": "Hatchback",
        "sport utility": "SUV",
        "suv": "SUV",
        "crossover": "SUV",
        "pickup": "Truck",
        "truck": "Truck",
        "van": "Van",
        "minivan": "Van",
    }
    
    value_lower = nhtsa_value.lower()
    for key, result in mapping.items():
        if key in value_lower:
            return result
    
    return None


def _map_transmission(nhtsa_value: str | None) -> str | None:
    """Map NHTSA transmission to Dealer Vehicle transmission options."""
    if not nhtsa_value:
        return None
    
    value_lower = nhtsa_value.lower()
    
    if "automatic" in value_lower or "auto" in value_lower:
        return "Automatic"
    if "manual" in value_lower:
        return "Manual"
    if "cvt" in value_lower or "continuously variable" in value_lower:
        return "CVT"
    
    return None


def _map_drivetrain(nhtsa_value: str | None) -> str | None:
    """Map NHTSA drive type to Dealer Vehicle drivetrain options."""
    if not nhtsa_value:
        return None
    
    value_lower = nhtsa_value.lower()
    
    if "4x4" in value_lower or "4wd" in value_lower or "four wheel" in value_lower:
        return "4WD"
    if "awd" in value_lower or "all wheel" in value_lower:
        return "AWD"
    if "rwd" in value_lower or "rear wheel" in value_lower:
        return "RWD"
    if "fwd" in value_lower or "front wheel" in value_lower:
        return "FWD"
    
    return None


def _map_fuel_type(nhtsa_value: str | None) -> str | None:
    """Map NHTSA fuel type to Dealer Vehicle fuel_type options."""
    if not nhtsa_value:
        return None
    
    value_lower = nhtsa_value.lower()
    
    if "gasoline" in value_lower:
        return "Gasoline"
    if "diesel" in value_lower:
        return "Diesel"
    if "electric" in value_lower:
        return "Electric"
    if "hybrid" in value_lower:
        if "plug" in value_lower:
            return "Plug-in Hybrid"
        return "Hybrid"
    
    return None
```

### Update Dealer Vehicle Form to Use VIN Decoder

```javascript
// Add to dealer_management/dealer_management/doctype/dealer_vehicle/dealer_vehicle.js

frappe.ui.form.on("Dealer Vehicle", {
    vin: function(frm) {
        const vin = frm.doc.vin;
        if (vin && vin.length === 17 && frm.is_new()) {
            // Auto-decode VIN for new vehicles
            decode_and_fill(frm, vin);
        }
    },
    
    refresh: function(frm) {
        // Add decode button
        if (frm.doc.vin && frm.doc.vin.length === 17) {
            frm.add_custom_button(__("Decode VIN"), function() {
                decode_and_fill(frm, frm.doc.vin);
            }, __("Actions"));
        }
    },
});

function decode_and_fill(frm, vin) {
    frappe.call({
        method: "dealer_management.integrations.vin_decoder.decode_vin",
        args: { vin: vin },
        freeze: true,
        freeze_message: __("Decoding VIN..."),
        callback: function(r) {
            if (r.message) {
                const data = r.message;
                const fields_to_set = [
                    "year", "make", "model", "trim", "body_style",
                    "engine", "transmission", "drivetrain", "fuel_type", "doors"
                ];
                
                let changed = [];
                fields_to_set.forEach(field => {
                    if (data[field] && !frm.doc[field]) {
                        frm.set_value(field, data[field]);
                        changed.push(field);
                    }
                });
                
                if (changed.length > 0) {
                    frappe.show_alert({
                        message: __("VIN decoded: filled {0} fields", [changed.length]),
                        indicator: "green",
                    });
                } else {
                    frappe.show_alert({
                        message: __("VIN decoded but no new fields to fill"),
                        indicator: "blue",
                    });
                }
            }
        },
    });
}
```

---

## 4. External API Endpoints

### File: `dealer_management/api/vehicles.py`

```python
"""REST API endpoints for external integrations."""

import frappe
from frappe import _


@frappe.whitelist(allow_guest=False)
def get_vehicles(status=None, limit=100, offset=0):
    """
    GET /api/method/dealer_management.api.vehicles.get_vehicles
    
    Fetch vehicles from inventory.
    
    Args:
        status: Filter by status (optional)
        limit: Max results (default 100)
        offset: Pagination offset
    """
    frappe.has_permission("Dealer Vehicle", "read", throw=True)
    
    filters = {}
    if status:
        filters["status"] = status
    
    vehicles = frappe.get_all(
        "Dealer Vehicle",
        filters=filters,
        fields=[
            "name", "vin", "stock_number", "year", "make", "model", "trim",
            "status", "asking_price", "mileage_current", "exterior_color",
            "days_on_lot", "acquisition_date",
        ],
        limit=int(limit),
        start=int(offset),
        order_by="modified desc",
    )
    
    return {
        "data": vehicles,
        "count": len(vehicles),
        "offset": int(offset),
        "limit": int(limit),
    }


@frappe.whitelist(allow_guest=False)
def create_vehicle(vin, year, make, model, **kwargs):
    """
    POST /api/method/dealer_management.api.vehicles.create_vehicle
    
    Create a new vehicle from API.
    
    Args:
        vin: Vehicle Identification Number (required)
        year: Model year (required)
        make: Manufacturer (required)
        model: Model name (required)
        **kwargs: Optional fields (trim, status, asking_price, etc.)
    """
    frappe.has_permission("Dealer Vehicle", "create", throw=True)
    
    # Check for duplicate
    if frappe.db.exists("Dealer Vehicle", {"vin": vin}):
        frappe.throw(_("Vehicle with VIN {0} already exists").format(vin))
    
    vehicle = frappe.new_doc("Dealer Vehicle")
    vehicle.vin = vin
    vehicle.year = year
    vehicle.make = make
    vehicle.model = model
    
    # Set optional fields
    allowed_fields = [
        "trim", "stock_number", "status", "body_style", "exterior_color",
        "interior_color", "mileage_in", "asking_price", "floor_price",
        "title_status", "acquisition_date",
    ]
    
    for field in allowed_fields:
        if field in kwargs and kwargs[field]:
            vehicle.set(field, kwargs[field])
    
    vehicle.insert()
    
    return {
        "success": True,
        "vehicle": vehicle.name,
        "message": _("Vehicle created successfully"),
    }


@frappe.whitelist(allow_guest=True)
def webhook_auction_purchase():
    """
    POST /api/method/dealer_management.api.vehicles.webhook_auction_purchase
    
    Webhook endpoint for auction platforms to notify of purchases.
    Expects JSON body with auction purchase data.
    """
    # Verify webhook signature (implementation depends on provider)
    # verify_webhook_signature(frappe.request)
    
    data = frappe.request.get_json()
    
    if not data:
        frappe.throw(_("No data provided"))
    
    # Queue the import job
    frappe.enqueue(
        "dealer_management.api.vehicles._process_auction_webhook",
        data=data,
        queue="default",
    )
    
    return {"success": True, "message": "Queued for processing"}


def _process_auction_webhook(data):
    """Process an auction webhook in the background."""
    # Implementation would depend on the auction platform's data format
    # This is a placeholder showing the structure
    
    vin = data.get("vin")
    if not vin:
        return
    
    # Check for existing vehicle
    existing = frappe.db.get_value("Dealer Vehicle", {"vin": vin}, "name")
    
    if existing:
        # Update existing vehicle
        vehicle = frappe.get_doc("Dealer Vehicle", existing)
    else:
        # Create new vehicle
        vehicle = frappe.new_doc("Dealer Vehicle")
        vehicle.vin = vin
        vehicle.year = data.get("year")
        vehicle.make = data.get("make")
        vehicle.model = data.get("model")
    
    # Set acquisition data
    vehicle.acquisition_date = data.get("purchase_date")
    vehicle.status = "Awaiting Pickup"
    
    if existing:
        vehicle.save()
    else:
        vehicle.insert()
    
    # Create acquisition record
    acq = frappe.new_doc("Vehicle Acquisition")
    acq.vehicle = vehicle.name
    acq.source_type = "Auction"
    acq.auction_name = data.get("auction_name")
    acq.purchase_date = data.get("purchase_date")
    acq.bid_amount = data.get("bid_amount")
    acq.buyer_fee = data.get("buyer_fee")
    acq.insert()
    
    vehicle.db_set("acquisition", acq.name)
    
    frappe.db.commit()
```

---

## Summary

This guide provides implementation patterns for:

1. **Bulk Vehicle Import** - CSV/Excel with column mapping, validation, and batch creation
2. **Expense Import** - Bank statement parsing with auto-categorization
3. **VIN Decoder** - Free NHTSA API integration with field mapping
4. **External APIs** - REST endpoints and webhook receivers for integrations

Each implementation follows Frappe/ERPNext patterns and can be added incrementally without disrupting existing functionality.
