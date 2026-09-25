"""Import vehicle data from an uploaded title, bill of sale, listing, or auction report.

Flow:
1. ``extract_document`` reads an uploaded File with Claude, matches the VIN to an
   existing Dealer Vehicle, and returns the proposed field changes for review.
2. ``apply_document`` saves the fields the user confirmed: it updates the matched
   vehicle (or creates a new one), attaches the document, and optionally adds a
   listing row, a draft sale / acquisition, or auction condition and MMR records.
"""

import json
import os
import re

import frappe
from frappe import _
from frappe.utils import cint, flt, getdate, now_datetime, today

DEFAULT_MODEL = "claude-opus-5"
MAX_FILE_BYTES = 30 * 1024 * 1024

DOCUMENT_TYPES = ("title", "bill_of_sale", "listing", "auction_listing", "other")

# Dealer Vehicle fields that can be filled from any document, in display order.
VEHICLE_FIELDS = (
    "vin",
    "year",
    "make",
    "model",
    "trim",
    "body_style",
    "exterior_color",
    "interior_color",
    "doors",
    "transmission",
    "drivetrain",
    "fuel_type",
    "engine",
)

TITLE_FIELDS = ("title_status", "title_state", "title_number")

# Select fields on Dealer Vehicle whose extracted values must match an option.
SELECT_FIELDS = (
    "body_style",
    "transmission",
    "drivetrain",
    "fuel_type",
    "title_status",
)

VIN_PATTERN = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")
VIN_TRANSLITERATION = {
    **{str(d): d for d in range(10)},
    "A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "F": 6, "G": 7, "H": 8,
    "J": 1, "K": 2, "L": 3, "M": 4, "N": 5, "P": 7, "R": 9,
    "S": 2, "T": 3, "U": 4, "V": 5, "W": 6, "X": 7, "Y": 8, "Z": 9,
}
VIN_WEIGHTS = (8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2)


# ---------------------------------------------------------------------------
# Whitelisted API
# ---------------------------------------------------------------------------


@frappe.whitelist()
def extract_document(file_url, document_type=None, vehicle=None):
    """Read an uploaded document and return proposed changes for review.

    Args:
        file_url: URL of an uploaded File.
        document_type: Optional hint - title, bill_of_sale, listing or auction_listing.
        vehicle: Optional Dealer Vehicle the user started from.
    """
    frappe.has_permission("Dealer Vehicle", "read", throw=True)

    content, filename = _get_file_content(file_url)
    extracted = _call_claude(content, filename, document_type)

    doc_type = extracted.get("document_type")
    if document_type in DOCUMENT_TYPES and document_type != "other":
        doc_type = document_type
    if doc_type not in DOCUMENT_TYPES:
        doc_type = "other"

    warnings = list(extracted.get("warnings") or [])
    vin = normalize_vin(extracted.get("vin"))
    if vin and not VIN_PATTERN.match(vin):
        warnings.append(_("The VIN read from the document ({0}) is not a valid 17-character VIN.").format(vin))
    elif vin and not vin_check_digit_ok(vin):
        warnings.append(
            _("The VIN {0} fails the check-digit test. It may have been misread; please verify it.").format(vin)
        )

    matched = frappe.db.get_value("Dealer Vehicle", {"vin": vin}, "name") if vin else None
    if vehicle and matched and vehicle != matched:
        warnings.append(
            _("The document's VIN belongs to {0}, not the vehicle you started from ({1}).").format(matched, vehicle)
        )
    elif vehicle and not matched:
        current_vin = frappe.db.get_value("Dealer Vehicle", vehicle, "vin")
        if vin and current_vin and vin != current_vin:
            warnings.append(
                _("The document's VIN ({0}) does not match this vehicle's VIN ({1}).").format(vin, current_vin)
            )
        matched = vehicle

    current = frappe.get_doc("Dealer Vehicle", matched) if matched else None
    proposed = build_vehicle_values(doc_type, extracted, is_new=current is None)

    return {
        "document_type": doc_type,
        "file_url": file_url,
        "vin": vin,
        "vehicle": matched,
        "vehicle_label": _vehicle_label(current) if current else None,
        "changes": _describe_changes(proposed, current),
        "listing": build_listing(extracted) if doc_type == "listing" else None,
        "transaction": build_transaction(extracted) if doc_type == "bill_of_sale" else None,
        "auction": build_auction(extracted) if doc_type == "auction_listing" else None,
        "summary": extracted.get("summary"),
        "warnings": warnings,
    }


@frappe.whitelist()
def apply_document(file_url, document_type, values, vehicle=None, listing=None, transaction=None, auction=None):
    """Save the reviewed values to a Dealer Vehicle (updating or creating it).

    Args:
        file_url: URL of the uploaded document, attached to the vehicle.
        document_type: title, bill_of_sale, listing, auction_listing or other.
        values: JSON dict of Dealer Vehicle fieldname -> value to set.
        vehicle: Dealer Vehicle to update. When empty, the VIN is looked up and
            a new vehicle is created if none exists.
        listing: Optional JSON dict for a Vehicle Listing row.
        transaction: Optional JSON dict; ``record_as`` of Sale or Purchase creates
            a draft Vehicle Sale or a Vehicle Acquisition.
        auction: Optional JSON dict from an auction report; ``add_note``,
            ``create_market_info`` and ``create_condition`` choose what to record.
    """
    values = frappe.parse_json(values) or {}
    listing = frappe.parse_json(listing) if listing else None
    transaction = frappe.parse_json(transaction) if transaction else None
    auction = frappe.parse_json(auction) if auction else None

    values = {k: v for k, v in values.items() if k in _allowed_vehicle_fields() and v not in (None, "")}
    if values.get("vin"):
        values["vin"] = normalize_vin(values["vin"])

    if not vehicle and values.get("vin"):
        vehicle = frappe.db.get_value("Dealer Vehicle", {"vin": values["vin"]}, "name")

    if vehicle:
        doc = frappe.get_doc("Dealer Vehicle", vehicle)
        doc.check_permission("write")
        created = False
    else:
        frappe.has_permission("Dealer Vehicle", "create", throw=True)
        missing = [f for f in ("vin", "year", "make", "model") if not values.get(f)]
        if missing:
            frappe.throw(
                _("A new vehicle needs {0}. Fill them in before saving.").format(", ".join(missing))
            )
        doc = frappe.new_doc("Dealer Vehicle")
        created = True

    doc.update(values)
    if values.get("lienholder_name"):
        doc.lienholder = _find_by_name("Lienholder", "lienholder_name", values["lienholder_name"]) or doc.lienholder
    if document_type == "title":
        doc.title_copy = file_url
    if listing and listing.get("apply"):
        _upsert_listing(doc, listing)
    if document_type == "auction_listing" and auction and auction.get("add_note") and auction.get("note"):
        doc.append("notes", {"note_type": "General", "note_date": now_datetime(), "note": auction["note"]})

    if created:
        doc.insert()
    else:
        doc.save()

    _attach_file(file_url, doc)

    related = []
    record_as = (transaction or {}).get("record_as")
    if document_type == "bill_of_sale" and record_as in ("Sale", "Purchase"):
        related.append(_create_transaction(doc, record_as, transaction, file_url))
    if document_type == "auction_listing" and auction:
        related.extend(_create_auction_records(doc, auction, file_url))

    return {
        "vehicle": doc.name,
        "created": created,
        "related": [{"doctype": d.doctype, "name": d.name} for d in related],
    }


# ---------------------------------------------------------------------------
# Mapping helpers (pure; no database access)
# ---------------------------------------------------------------------------


def normalize_vin(vin):
    if not vin:
        return None
    return re.sub(r"[\s-]", "", str(vin)).upper() or None


def vin_check_digit_ok(vin):
    """Validate position 9 of a 17-character North American VIN."""
    try:
        total = sum(VIN_TRANSLITERATION[c] * w for c, w in zip(vin, VIN_WEIGHTS))
    except KeyError:
        return False
    remainder = total % 11
    expected = "X" if remainder == 10 else str(remainder)
    return vin[8] == expected


def match_option(value, options):
    """Return the option matching ``value`` case-insensitively, else None."""
    if value in (None, ""):
        return None
    wanted = str(value).strip().lower()
    for option in options:
        if option and option.lower() == wanted:
            return option
    return None


def build_vehicle_values(document_type, extracted, is_new, select_options=None):
    """Map extracted data to Dealer Vehicle fieldnames."""
    values = {}
    for field in VEHICLE_FIELDS:
        values[field] = extracted.get(field)
    values["vin"] = normalize_vin(values["vin"])

    mileage = extracted.get("mileage")
    if mileage:
        values["mileage_current"] = mileage
        if is_new:
            values["mileage_in"] = mileage

    if document_type == "title":
        for field in TITLE_FIELDS:
            values[field] = extracted.get(field)
        values["title_received"] = 1
        values["title_received_date"] = today()
        if extracted.get("lienholder_name"):
            values["has_lien"] = 1
            values["lienholder_name"] = extracted["lienholder_name"]

    elif document_type == "listing":
        values["asking_price"] = extracted.get("price")
        values["features"] = extracted.get("features")
        values["description"] = extracted.get("description")

    elif document_type == "auction_listing":
        values["features"] = extracted.get("features")
        values["title_status"] = extracted.get("title_status")

    elif document_type == "bill_of_sale":
        values["title_status"] = extracted.get("title_status")

    select_options = select_options if select_options is not None else _select_options()
    for field in SELECT_FIELDS:
        if field in values and field in select_options:
            values[field] = match_option(values[field], select_options[field])

    return {k: v for k, v in values.items() if v not in (None, "")}


def build_listing(extracted):
    return {
        "apply": 1,
        "platform": extracted.get("listing_platform"),
        "listing_url": extracted.get("listing_url"),
        "listing_id": extracted.get("listing_id"),
        "listed_date": extracted.get("document_date"),
        "listed_price": extracted.get("price"),
    }


def build_auction(extracted):
    """Proposed note, MMR and condition records from an auction report."""
    header = " - ".join(
        p for p in (extracted.get("auction_name"), extracted.get("auction_location"), extracted.get("document_date")) if p
    )
    lines = [header] if header else []
    for label, key in (
        ("Lane/Run", "lane_run"),
        ("Seller", "auction_seller"),
        ("Condition grade", "condition_grade"),
        ("Announcements", "announcements"),
        ("History", "history_notes"),
        ("MMR range", "mmr_range"),
    ):
        if extracted.get(key):
            lines.append(f"{label}: {extracted[key]}")

    damage = extracted.get("damage_description")
    return {
        "add_note": 1 if lines else 0,
        "note": "\n".join(lines),
        "create_market_info": 1 if extracted.get("mmr_value") else 0,
        "mmr_value": extracted.get("mmr_value"),
        "mmr_range": extracted.get("mmr_range"),
        "info_date": extracted.get("document_date"),
        "create_condition": 1 if (damage or extracted.get("condition_grade")) else 0,
        "inspection_date": extracted.get("inspection_date") or extracted.get("document_date"),
        "inspected_by": extracted.get("auction_name"),
        "damage_description": damage,
        "exterior_notes": extracted.get("exterior_condition"),
        "interior_notes": extracted.get("interior_condition"),
        "mechanical_notes": extracted.get("mechanical_condition"),
        "tire_details": extracted.get("tire_details"),
    }


def build_transaction(extracted):
    return {
        "record_as": extracted.get("transaction_direction") or "None",
        "date": extracted.get("document_date"),
        "price": extracted.get("price"),
        "buyer_name": extracted.get("buyer_name"),
        "buyer_address": extracted.get("buyer_address"),
        "buyer_phone": extracted.get("buyer_phone"),
        "buyer_email": extracted.get("buyer_email"),
        "seller_name": extracted.get("seller_name"),
        "seller_contact": extracted.get("seller_address"),
    }


# ---------------------------------------------------------------------------
# Claude
# ---------------------------------------------------------------------------


# Every field is required and non-nullable; the model uses "" (or 0 for
# numbers) when a value is not shown, which _clean_extraction turns into None.
def _extraction_schema():
    string = {"type": "string"}
    integer = {"type": "integer"}
    number = {"type": "number"}
    properties = {
        "document_type": {"type": "string", "enum": list(DOCUMENT_TYPES)},
        "summary": string,
        "vin": string,
        "year": integer,
        "make": string,
        "model": string,
        "trim": string,
        "body_style": string,
        "exterior_color": string,
        "interior_color": string,
        "doors": integer,
        "transmission": string,
        "drivetrain": string,
        "fuel_type": string,
        "engine": string,
        "mileage": integer,
        "title_status": string,
        "title_state": string,
        "title_number": string,
        "lienholder_name": string,
        "document_date": string,
        "price": number,
        "listing_platform": string,
        "listing_url": string,
        "listing_id": string,
        "features": string,
        "description": string,
        "transaction_direction": {"type": "string", "enum": ["Sale", "Purchase", ""]},
        "buyer_name": string,
        "buyer_address": string,
        "buyer_phone": string,
        "buyer_email": string,
        "seller_name": string,
        "seller_address": string,
        "auction_name": string,
        "auction_location": string,
        "lane_run": string,
        "auction_seller": string,
        "announcements": string,
        "condition_grade": string,
        "history_notes": string,
        "mmr_value": number,
        "mmr_range": string,
        "inspection_date": string,
        "damage_description": string,
        "exterior_condition": string,
        "interior_condition": string,
        "mechanical_condition": string,
        "tire_details": string,
        "warnings": {"type": "array", "items": {"type": "string"}},
    }
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }


def _system_prompt():
    options = _select_options()
    dealer = _dealer_name()
    return f"""You read documents for an independent used-car dealer and extract vehicle data for their inventory system.

The document will be one of:
- title: a vehicle certificate of title.
- bill_of_sale: a bill of sale for a vehicle.
- listing: a retail advertisement offering a vehicle to consumers (Facebook Marketplace, Craigslist, CarGurus, Cars.com, Autotrader, a dealer website, a window sticker, etc.).
- auction_listing: a wholesale auction listing, run list entry, or condition report (Manheim, ADESA, ACV, OVE, America's Auto Auction, etc.).
- other: anything else.

Rules:
- Only report values that actually appear in the document. Use an empty string (or 0 for numbers) for anything not shown; do not guess or fill in from general knowledge.
- vin: copy all 17 characters exactly. VINs never contain I, O, or Q.
- make and model: use normal capitalization (e.g. "Toyota", "F-150").
- mileage: the odometer reading as a whole number.
- price: the asking price for a listing, or the sale price for a bill of sale, as a plain number.
- document_date: the listing date, sale date, or title issue date, formatted YYYY-MM-DD.
- title_state: the two-letter state abbreviation.
- lienholder_name: the first lienholder shown on a title, or an empty string if none is listed or the lien is marked released.
- Use these exact values where applicable, or an empty string if none fits:
  body_style: {", ".join(o for o in options.get("body_style", []) if o)}
  transmission: {", ".join(o for o in options.get("transmission", []) if o)}
  drivetrain: {", ".join(o for o in options.get("drivetrain", []) if o)}
  fuel_type: {", ".join(o for o in options.get("fuel_type", []) if o)}
  title_status: {", ".join(o for o in options.get("title_status", []) if o)}
- For a bill of sale, set transaction_direction to "Sale" if the dealer ({dealer}) is the seller, "Purchase" if the dealer is the buyer, or an empty string if you cannot tell.
- For a listing, put the listed options/equipment in features (comma-separated) and the seller's description text in description.
- For an auction_listing:
  - price is the asking or buy-now price only if one is shown; do not put MMR or valuation figures in price.
  - features: packages and optional equipment (comma-separated); skip standard equipment.
  - auction_name: the auction house (e.g. "Manheim Central Florida"); auction_location: where the car is; lane_run: lane and run number; auction_seller: the consignor.
  - document_date: the sale/run date; inspection_date: the condition report date.
  - announcements: the announcements and remarks, verbatim.
  - condition_grade: the condition report score/grade as shown (e.g. "4.5").
  - history_notes: owners, accidents, title or odometer problems shown (e.g. "1 owner, 1 accident").
  - mmr_value: the adjusted MMR if shown, otherwise the base MMR; mmr_range: the MMR range as text.
  - damage_description: each reported damage item on its own line as "Item: condition" (e.g. "Hood: Chipped").
  - exterior_condition / interior_condition / mechanical_condition: short summaries of those condition sections.
  - tire_details: tread depth and sizes per tire.
- summary: one sentence describing the document.
- warnings: note anything illegible, contradictory, or suspicious (e.g. a VIN that is partly unreadable, mileage marked "not actual", a salvage brand)."""


def _call_claude(content, filename, document_type=None):
    import anthropic
    import base64

    from dealer_management.dealer_management.doctype.ai_settings.ai_settings import (
        get_anthropic_credentials,
    )

    api_key, workspace_id, global_model = get_anthropic_credentials()
    if not api_key:
        frappe.throw(
            _("Add an Anthropic API key in AI Settings before importing documents."),
            title=_("Not Configured"),
        )

    import_settings = frappe.get_single("Document Import Settings")
    model = import_settings.model or global_model or DEFAULT_MODEL

    extension = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    if extension == "pdf" or content[:5] == b"%PDF-":
        data = base64.standard_b64encode(content).decode("utf-8")
        block = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": data}}
    else:
        image, media_type = _prepare_image(content, filename)
        data = base64.standard_b64encode(image).decode("utf-8")
        block = {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}}

    hint = f" The user says this is a {document_type.replace('_', ' ')}." if document_type in DOCUMENT_TYPES else ""
    request = {
        "model": model,
        "max_tokens": 16000,
        "system": _system_prompt(),
        "messages": [
            {
                "role": "user",
                "content": [block, {"type": "text", "text": f"Extract the vehicle data from this document.{hint}"}],
            }
        ],
        "output_config": {"format": {"type": "json_schema", "schema": _extraction_schema()}},
    }
    default_headers = {"anthropic-workspace-id": workspace_id} if workspace_id else None
    client = anthropic.Anthropic(api_key=api_key, default_headers=default_headers)
    try:
        try:
            response = client.beta.messages.create(
                betas=["server-side-fallback-2026-07-01"], fallbacks="default", **request
            )
        except anthropic.BadRequestError as e:
            # Not every account or model accepts server-side fallbacks; retry once without.
            frappe.log_error(title="Document import: retrying without fallbacks", message=_api_error_message(e))
            response = client.messages.create(**request)
    except anthropic.AuthenticationError:
        frappe.throw(_("The Anthropic API key was rejected. Check Document Import Settings."))
    except anthropic.PermissionDeniedError as e:
        frappe.throw(_("The Anthropic API key is not allowed to do this: {0}").format(_api_error_message(e)))
    except anthropic.NotFoundError:
        frappe.throw(
            _("The model {0} is not available to this API key. Change it in Document Import Settings.").format(
                request["model"]
            )
        )
    except anthropic.RateLimitError:
        frappe.throw(_("The document reader is busy. Please try again in a minute."))
    except anthropic.APIStatusError as e:
        message = _api_error_message(e)
        frappe.log_error(title="Document import failed", message=f"{e.status_code}: {message}")
        frappe.throw(_("The document could not be read ({0}): {1}").format(e.status_code, message))
    except anthropic.APIConnectionError:
        frappe.throw(_("Could not reach the document reader. Check the server's internet access."))

    if response.stop_reason == "refusal":
        frappe.throw(_("The document reader declined to process this file."))
    if response.stop_reason == "max_tokens":
        frappe.throw(_("The document was too long to read in one pass."))

    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        frappe.throw(_("The document reader returned no data."))
    return _clean_extraction(json.loads(text))


def _api_error_message(error):
    """The API's own explanation, e.g. "Your credit balance is too low..."."""
    body = error.body if isinstance(error.body, dict) else {}
    return (body.get("error") or {}).get("message") or error.message


# Claude accepts images up to 5 MB and 8000 px per side; larger ones are downscaled.
MAX_IMAGE_BYTES = 3_700_000  # base64 adds a third, keeping the encoded image under 5 MB
MAX_IMAGE_SIDE = 2400


def _prepare_image(content, filename):
    """Return (bytes, media_type) for an uploaded image, re-encoding it when needed."""
    from io import BytesIO

    from PIL import Image, ImageOps

    try:
        image = Image.open(BytesIO(content))
        image.load()
    except Exception:
        frappe.throw(
            _("{0} could not be opened as an image. Upload a PDF, JPG, PNG, GIF or WEBP file.").format(filename)
        )

    media_type = {"JPEG": "image/jpeg", "PNG": "image/png", "GIF": "image/gif", "WEBP": "image/webp"}.get(
        image.format
    )
    if media_type and len(content) <= MAX_IMAGE_BYTES and max(image.size) <= MAX_IMAGE_SIDE:
        return content, media_type

    image = ImageOps.exif_transpose(image).convert("RGB")
    image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    quality = 85
    while True:
        out = BytesIO()
        image.save(out, format="JPEG", quality=quality)
        if out.tell() <= MAX_IMAGE_BYTES or quality <= 40:
            return out.getvalue(), "image/jpeg"
        quality -= 15


def _clean_extraction(data):
    """Turn the schema's "" / 0 placeholders into None."""
    cleaned = {}
    for key, value in data.items():
        if isinstance(value, str):
            value = value.strip() or None
        elif isinstance(value, (int, float)) and not isinstance(value, bool) and value == 0:
            value = None
        cleaned[key] = value
    return cleaned


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def _get_file_content(file_url):
    file_name = frappe.db.get_value("File", {"file_url": file_url}, "name")
    if not file_name:
        frappe.throw(_("File {0} not found.").format(file_url))
    file_doc = frappe.get_doc("File", file_name)
    file_doc.check_permission("read")
    if cint(file_doc.file_size) > MAX_FILE_BYTES:
        frappe.throw(_("The file is larger than 30 MB. Upload a smaller scan or photo."))
    return file_doc.get_content(), file_doc.file_name or file_url


def _select_options():
    meta = frappe.get_meta("Dealer Vehicle")
    return {f: (meta.get_field(f).options or "").split("\n") for f in SELECT_FIELDS if meta.get_field(f)}


def _allowed_vehicle_fields():
    return set(VEHICLE_FIELDS) | set(TITLE_FIELDS) | {
        "mileage_in",
        "mileage_current",
        "title_received",
        "title_received_date",
        "has_lien",
        "lienholder_name",
        "asking_price",
        "features",
        "description",
    }


def _dealer_name():
    company = frappe.defaults.get_global_default("company")
    return company or "the dealership"


def _vehicle_label(doc):
    return " ".join(str(p) for p in (doc.name, "-", doc.year, doc.make, doc.model, doc.trim) if p)


def _describe_changes(proposed, current):
    meta = frappe.get_meta("Dealer Vehicle")
    changes = []
    for fieldname, new in proposed.items():
        df = meta.get_field(fieldname)
        if not df:
            continue
        old = current.get(fieldname) if current else None
        if _same_value(old, new, df.fieldtype):
            continue
        changes.append(
            {
                "fieldname": fieldname,
                "label": _(df.label),
                "fieldtype": df.fieldtype,
                "options": df.options if df.fieldtype == "Select" else None,
                "current": old,
                "new": new,
            }
        )
    return changes


def _same_value(old, new, fieldtype):
    if old in (None, "") or new in (None, ""):
        return old in (None, "") and new in (None, "")
    if fieldtype in ("Int", "Check"):
        return cint(old) == cint(new)
    if fieldtype in ("Currency", "Float"):
        return flt(old) == flt(new)
    if fieldtype == "Date":
        try:
            return getdate(old) == getdate(new)
        except Exception:
            return False
    return str(old).strip().lower() == str(new).strip().lower()


def _find_by_name(doctype, name_field, value):
    if not value:
        return None
    return frappe.db.get_value(doctype, {name_field: ("like", value.strip())}, "name")


def _upsert_listing(doc, listing):
    platform = _find_by_name("Listing Platform", "platform_name", listing.get("platform"))
    row = None
    for existing in doc.listings or []:
        if listing.get("listing_url") and existing.listing_url == listing["listing_url"]:
            row = existing
        elif platform and existing.platform == platform:
            row = existing
        if row:
            break
    if not row:
        row = doc.append("listings", {"status": "Active"})

    if platform:
        row.platform = platform
    elif listing.get("platform"):
        row.notes = _("Platform: {0}").format(listing["platform"])
    for field in ("listing_url", "listing_id", "listed_date", "listed_price"):
        if listing.get(field) not in (None, ""):
            row.set(field, listing[field])
    row.last_updated = today()


def _attach_file(file_url, doc):
    """Link the uploaded File to the vehicle so it shows in its attachments."""
    file_name = frappe.db.get_value("File", {"file_url": file_url, "attached_to_name": ["is", "not set"]}, "name")
    if file_name:
        frappe.db.set_value(
            "File", file_name, {"attached_to_doctype": doc.doctype, "attached_to_name": doc.name}
        )


def _create_auction_records(vehicle, data, file_url):
    records = []
    if data.get("create_market_info") and data.get("mmr_value"):
        market = frappe.new_doc("Vehicle Market Info")
        market.update(
            {
                "vehicle": vehicle.name,
                "info_date": data.get("info_date") or today(),
                "mmr_value": flt(data.get("mmr_value")),
                "notes": _("MMR range: {0}").format(data["mmr_range"]) if data.get("mmr_range") else None,
            }
        )
        market.insert()
        records.append(market)

    if data.get("create_condition"):
        condition = frappe.new_doc("Vehicle Condition")
        damage = data.get("damage_description")
        condition.update(
            {
                "vehicle": vehicle.name,
                "inspection_date": data.get("inspection_date") or today(),
                "inspected_by": data.get("inspected_by"),
                "has_damage": 1 if damage else 0,
                "damage_description": damage,
                "damage_photos": file_url,
                "exterior_notes": data.get("exterior_notes"),
                "interior_notes": data.get("interior_notes"),
                "mechanical_notes": data.get("mechanical_notes"),
                "tire_details": (data.get("tire_details") or "")[:140] or None,
            }
        )
        condition.insert()
        records.append(condition)
    return records


def _create_transaction(vehicle, record_as, data, file_url):
    if record_as == "Sale":
        sale = frappe.new_doc("Vehicle Sale")
        sale.update(
            {
                "vehicle": vehicle.name,
                "sale_date": data.get("date") or today(),
                "sale_type": "Retail",
                "buyer_name": data.get("buyer_name"),
                "buyer_address": data.get("buyer_address"),
                "buyer_phone": data.get("buyer_phone"),
                "buyer_email": data.get("buyer_email"),
                "sale_price": flt(data.get("price")),
                "bill_of_sale": file_url,
            }
        )
        sale.insert()
        return sale

    acquisition = frappe.new_doc("Vehicle Acquisition")
    acquisition.update(
        {
            "vehicle": vehicle.name,
            "source_type": "Private Purchase",
            "purchase_date": data.get("date") or today(),
            "seller_name": data.get("seller_name"),
            "seller_contact": data.get("seller_contact"),
            "bid_amount": flt(data.get("price")),
            "purchase_receipt": file_url,
        }
    )
    acquisition.insert()
    if not vehicle.acquisition:
        vehicle.db_set("acquisition", acquisition.name)
    if not vehicle.acquisition_date:
        vehicle.db_set("acquisition_date", acquisition.purchase_date)
    return acquisition
