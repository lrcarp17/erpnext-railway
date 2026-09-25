frappe.provide("dealer_management.document_import");

(function () {
// Upload a title, bill of sale, or listing, review what was read, and apply it
// to the matching Vehicle Inventory (or a new one). Pass `frm` when starting from
// a vehicle form so the document is checked against that vehicle.
dealer_management.document_import.open = function (frm) {
    const dialog = new frappe.ui.Dialog({
        title: frm ? __("Update from Document") : __("Import from Document"),
        fields: [
            {
                fieldname: "file_url",
                fieldtype: "Attach",
                label: __("Title, Bill of Sale, Listing, or Auction Report"),
                reqd: 1,
                options: {
                    restrictions: {
                        allowed_file_types: ["image/*", ".pdf"],
                    },
                },
                description: __("A PDF, scan, photo, or screenshot."),
            },
            {
                fieldname: "document_type",
                fieldtype: "Select",
                label: __("Document Type"),
                options: [
                    { value: "", label: __("Detect automatically") },
                    { value: "title", label: __("Title") },
                    { value: "bill_of_sale", label: __("Bill of Sale") },
                    { value: "listing", label: __("Listing") },
                    { value: "auction_listing", label: __("Auction Listing / Condition Report") },
                ],
            },
        ],
        primary_action_label: __("Read Document"),
        primary_action(values) {
            dialog.disable_primary_action();
            frappe.call({
                method: "dealer_management.document_import.extract_document",
                args: {
                    file_url: values.file_url,
                    document_type: values.document_type || null,
                    vehicle: frm ? frm.doc.name : null,
                },
                freeze: true,
                freeze_message: __("Reading document..."),
                callback(r) {
                    if (r.message) {
                        dialog.hide();
                        show_review(r.message, frm);
                    }
                },
                always() {
                    dialog.enable_primary_action();
                },
            });
        },
    });
    dialog.show();
};

const DOCUMENT_LABELS = {
    title: __("Title"),
    bill_of_sale: __("Bill of Sale"),
    listing: __("Listing"),
    auction_listing: __("Auction Listing"),
    other: __("Document"),
};

function show_review(result, frm) {
    const esc = frappe.utils.escape_html;
    const fields = [{ fieldname: "info_html", fieldtype: "HTML" }];

    fields.push(
        { fieldtype: "Section Break", label: __("Vehicle Fields") },
        { fieldname: "changes_html", fieldtype: "HTML" }
    );

    const listing = result.listing;
    if (listing) {
        fields.push(
            { fieldtype: "Section Break", label: __("Listing") },
            {
                fieldname: "listing_apply",
                fieldtype: "Check",
                label: __("Add or update this listing on the vehicle"),
                default: 1,
            },
            { fieldname: "listing_platform", fieldtype: "Data", label: __("Platform"), default: listing.platform },
            { fieldname: "listing_url", fieldtype: "Data", label: __("Listing URL"), default: listing.listing_url },
            { fieldname: "listing_id", fieldtype: "Data", label: __("Listing ID"), default: listing.listing_id },
            { fieldtype: "Column Break" },
            {
                fieldname: "listed_price",
                fieldtype: "Currency",
                label: __("Listed Price"),
                default: listing.listed_price,
            },
            { fieldname: "listed_date", fieldtype: "Date", label: __("Listed Date"), default: listing.listed_date }
        );
    }

    const txn = result.transaction;
    if (txn) {
        const is_sale = "eval:doc.record_as=='Sale'";
        const is_purchase = "eval:doc.record_as=='Purchase'";
        fields.push(
            { fieldtype: "Section Break", label: __("Bill of Sale") },
            {
                fieldname: "record_as",
                fieldtype: "Select",
                label: __("Also Create"),
                options: [
                    { value: "None", label: __("Nothing, just update the vehicle") },
                    { value: "Sale", label: __("Draft Vehicle Sale (we sold it)") },
                    { value: "Purchase", label: __("Vehicle Acquisition (we bought it)") },
                ],
                default: txn.record_as || "None",
            },
            {
                fieldname: "txn_date",
                fieldtype: "Date",
                label: __("Date"),
                default: txn.date,
                depends_on: "eval:doc.record_as!='None'",
            },
            {
                fieldname: "txn_price",
                fieldtype: "Currency",
                label: __("Price"),
                default: txn.price,
                depends_on: "eval:doc.record_as!='None'",
                mandatory_depends_on: "eval:doc.record_as!='None'",
            },
            { fieldtype: "Column Break" },
            {
                fieldname: "buyer_name",
                fieldtype: "Data",
                label: __("Buyer Name"),
                default: txn.buyer_name,
                depends_on: is_sale,
                mandatory_depends_on: is_sale,
            },
            {
                fieldname: "buyer_phone",
                fieldtype: "Data",
                label: __("Buyer Phone"),
                default: txn.buyer_phone,
                depends_on: is_sale,
            },
            {
                fieldname: "buyer_email",
                fieldtype: "Data",
                options: "Email",
                label: __("Buyer Email"),
                default: txn.buyer_email,
                depends_on: is_sale,
            },
            {
                fieldname: "buyer_address",
                fieldtype: "Small Text",
                label: __("Buyer Address"),
                default: txn.buyer_address,
                depends_on: is_sale,
            },
            {
                fieldname: "seller_name",
                fieldtype: "Data",
                label: __("Seller Name"),
                default: txn.seller_name,
                depends_on: is_purchase,
            },
            {
                fieldname: "seller_contact",
                fieldtype: "Data",
                label: __("Seller Contact"),
                default: txn.seller_contact,
                depends_on: is_purchase,
            }
        );
    }

    const auction = result.auction;
    if (auction) {
        const note_on = "eval:doc.auction_add_note";
        const mmr_on = "eval:doc.auction_create_market_info";
        const cond_on = "eval:doc.auction_create_condition";
        fields.push(
            { fieldtype: "Section Break", label: __("Auction Report") },
            {
                fieldname: "auction_add_note",
                fieldtype: "Check",
                label: __("Add a note with the auction details"),
                default: auction.add_note,
            },
            {
                fieldname: "auction_note",
                fieldtype: "Small Text",
                label: __("Note"),
                default: auction.note,
                depends_on: note_on,
            },
            {
                fieldname: "auction_create_market_info",
                fieldtype: "Check",
                label: __("Record MMR in Vehicle Market Info"),
                default: auction.create_market_info,
            },
            {
                fieldname: "mmr_value",
                fieldtype: "Currency",
                label: __("MMR"),
                default: auction.mmr_value,
                depends_on: mmr_on,
                mandatory_depends_on: mmr_on,
            },
            {
                fieldname: "mmr_range",
                fieldtype: "Data",
                label: __("MMR Range"),
                default: auction.mmr_range,
                depends_on: mmr_on,
            },
            { fieldtype: "Column Break" },
            {
                fieldname: "auction_create_condition",
                fieldtype: "Check",
                label: __("Create a Vehicle Condition record"),
                default: auction.create_condition,
            },
            {
                fieldname: "inspection_date",
                fieldtype: "Date",
                label: __("Inspection Date"),
                default: auction.inspection_date,
                depends_on: cond_on,
            },
            {
                fieldname: "damage_description",
                fieldtype: "Small Text",
                label: __("Damage"),
                default: auction.damage_description,
                depends_on: cond_on,
            },
            {
                fieldname: "exterior_notes",
                fieldtype: "Small Text",
                label: __("Exterior"),
                default: auction.exterior_notes,
                depends_on: cond_on,
            },
            {
                fieldname: "interior_notes",
                fieldtype: "Small Text",
                label: __("Interior"),
                default: auction.interior_notes,
                depends_on: cond_on,
            },
            {
                fieldname: "mechanical_notes",
                fieldtype: "Small Text",
                label: __("Mechanical"),
                default: auction.mechanical_notes,
                depends_on: cond_on,
            },
            {
                fieldname: "tire_details",
                fieldtype: "Data",
                label: __("Tires"),
                default: auction.tire_details,
                depends_on: cond_on,
            }
        );
    }

    const dialog = new frappe.ui.Dialog({
        title: __("Review {0}", [DOCUMENT_LABELS[result.document_type] || __("Document")]),
        size: "large",
        fields: fields,
        primary_action_label: result.vehicle
            ? __("Update {0}", [result.vehicle])
            : __("Create Vehicle"),
        primary_action(values) {
            apply(dialog, result, values, frm);
        },
    });

    // Target vehicle, summary and warnings.
    let info = "";
    if (result.summary) {
        info += `<p class="text-muted">${esc(result.summary)}</p>`;
    }
    info += result.vehicle
        ? `<p>${__("Matched by VIN to")} <a href="/app/vehicle-inventory/${encodeURIComponent(result.vehicle)}" target="_blank"><b>${esc(result.vehicle_label || result.vehicle)}</b></a>.</p>`
        : `<p>${__("No vehicle with this VIN exists yet. A new vehicle will be created.")}</p>`;
    if (result.warnings && result.warnings.length) {
        info += `<div class="alert alert-warning"><ul class="mb-0">${result.warnings
            .map((w) => `<li>${esc(w)}</li>`)
            .join("")}</ul></div>`;
    }
    dialog.fields_dict.info_html.$wrapper.html(info);

    // Proposed field changes: tick to apply, edit the new value if needed.
    const $changes = dialog.fields_dict.changes_html.$wrapper;
    if (!result.changes.length) {
        $changes.html(`<p class="text-muted">${__("Nothing new to update on the vehicle.")}</p>`);
    } else {
        const rows = result.changes
            .map((c) => {
                const current = c.current === null || c.current === undefined || c.current === "" ? "" : c.current;
                return `<tr data-fieldname="${esc(c.fieldname)}">
                    <td><input type="checkbox" class="apply-change" checked></td>
                    <td>${esc(c.label)}</td>
                    <td class="text-muted">${current === "" ? `<i>${__("empty")}</i>` : esc(String(current))}</td>
                    <td>${value_input(c)}</td>
                </tr>`;
            })
            .join("");
        $changes.html(`
            <table class="table table-bordered table-sm">
                <thead><tr>
                    <th style="width: 32px;"><input type="checkbox" class="apply-all" checked></th>
                    <th>${__("Field")}</th>
                    <th>${__("Current")}</th>
                    <th>${__("From Document")}</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>`);
        $changes.find(".apply-all").on("change", function () {
            $changes.find(".apply-change").prop("checked", this.checked);
        });
    }

    dialog.show();
}

function value_input(change) {
    const esc = frappe.utils.escape_html;
    const value = change.new === null || change.new === undefined ? "" : String(change.new);
    if (change.fieldtype === "Select") {
        const options = (change.options || "")
            .split("\n")
            .map((o) => `<option value="${esc(o)}" ${o === value ? "selected" : ""}>${esc(o)}</option>`)
            .join("");
        return `<select class="form-control input-xs change-value">${options}</select>`;
    }
    if (change.fieldtype === "Check") {
        return `<input type="checkbox" class="change-value" ${value && value !== "0" ? "checked" : ""}>`;
    }
    if (["Text Editor", "Small Text", "Text"].includes(change.fieldtype)) {
        return `<textarea class="form-control input-xs change-value" rows="3">${esc(value)}</textarea>`;
    }
    const type = ["Int", "Currency", "Float"].includes(change.fieldtype)
        ? "number"
        : change.fieldtype === "Date"
        ? "date"
        : "text";
    return `<input type="${type}" class="form-control input-xs change-value" value="${esc(value)}">`;
}

function collect_values(dialog) {
    const values = {};
    dialog.fields_dict.changes_html.$wrapper.find("tbody tr").each(function () {
        const $row = $(this);
        if (!$row.find(".apply-change").prop("checked")) return;
        const $input = $row.find(".change-value");
        values[$row.data("fieldname")] = $input.is(":checkbox") ? ($input.prop("checked") ? 1 : 0) : $input.val();
    });
    return values;
}

function apply(dialog, result, values, frm) {
    const args = {
        file_url: result.file_url,
        document_type: result.document_type,
        vehicle: result.vehicle,
        values: collect_values(dialog),
    };
    if (result.listing) {
        args.listing = {
            apply: values.listing_apply,
            platform: values.listing_platform,
            listing_url: values.listing_url,
            listing_id: values.listing_id,
            listed_price: values.listed_price,
            listed_date: values.listed_date,
        };
    }
    if (result.transaction) {
        args.transaction = {
            record_as: values.record_as,
            date: values.txn_date,
            price: values.txn_price,
            buyer_name: values.buyer_name,
            buyer_phone: values.buyer_phone,
            buyer_email: values.buyer_email,
            buyer_address: values.buyer_address,
            seller_name: values.seller_name,
            seller_contact: values.seller_contact,
        };
    }

    if (result.auction) {
        args.auction = {
            add_note: values.auction_add_note,
            note: values.auction_note,
            create_market_info: values.auction_create_market_info,
            mmr_value: values.mmr_value,
            mmr_range: values.mmr_range,
            info_date: result.auction.info_date,
            create_condition: values.auction_create_condition,
            inspection_date: values.inspection_date,
            inspected_by: result.auction.inspected_by,
            damage_description: values.damage_description,
            exterior_notes: values.exterior_notes,
            interior_notes: values.interior_notes,
            mechanical_notes: values.mechanical_notes,
            tire_details: values.tire_details,
        };
    }

    dialog.disable_primary_action();
    frappe.call({
        method: "dealer_management.document_import.apply_document",
        args: args,
        freeze: true,
        freeze_message: __("Saving..."),
        callback(r) {
            if (!r.message) return;
            dialog.hide();
            const out = r.message;
            let message = out.created
                ? __("Created vehicle {0}.", [out.vehicle])
                : __("Updated vehicle {0}.", [out.vehicle]);
            (out.related || []).forEach((d) => {
                message += " " + __("Created {0} {1}.", [__(d.doctype), d.name]);
            });
            frappe.show_alert({ message: message, indicator: "green" }, 7);

            if (frm && frm.doc.name === out.vehicle) {
                frm.reload_doc();
            } else {
                frappe.set_route("Form", "Vehicle Inventory", out.vehicle);
            }
        },
        always() {
            dialog.enable_primary_action();
        },
    });
}
})();
