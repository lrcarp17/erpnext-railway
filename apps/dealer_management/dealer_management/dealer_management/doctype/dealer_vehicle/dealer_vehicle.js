frappe.ui.form.on("Dealer Vehicle", {
    refresh: function (frm) {
        if (!frm.is_new()) {
            frm.add_custom_button(__("Decode VIN"), function () {
                frm.trigger("decode_vin");
            });
            frm.add_custom_button(__("Update from Document"), function () {
                dealer_management.document_import.open(frm);
            });
        }

        frm.set_query("lienholder", function () {
            return {
                filters: {
                    enabled: 1,
                },
            };
        });

        frm.trigger("set_field_indicators");
    },

    vin: function (frm) {
        if (frm.doc.vin) {
            frm.set_value("vin", frm.doc.vin.toUpperCase().trim());
        }
    },

    decode_vin: function (frm) {
        if (!frm.doc.vin) {
            frappe.msgprint(__("Please enter a VIN first"));
            return;
        }

        frappe.call({
            method: "dealer_management.dealer_management.doctype.dealer_vehicle.dealer_vehicle.decode_vin",
            args: {
                vin: frm.doc.vin,
            },
            callback: function (r) {
                if (r.message) {
                    frappe.msgprint(r.message.message);
                }
            },
        });
    },

    lot_date: function (frm) {
        frm.trigger("calculate_days_on_lot");
    },

    calculate_days_on_lot: function (frm) {
        if (frm.doc.lot_date) {
            let lot_date = frappe.datetime.str_to_obj(frm.doc.lot_date);
            let today = frappe.datetime.str_to_obj(frappe.datetime.get_today());
            let days = frappe.datetime.get_diff(today, lot_date);
            frm.set_value("days_on_lot", Math.max(0, days));
        }
    },

    asking_price: function (frm) {
        frm.trigger("calculate_potential_profit");
    },

    calculate_potential_profit: function (frm) {
        let profit =
            flt(frm.doc.asking_price) - flt(frm.doc.total_investment);
        frm.set_value("potential_profit", profit);
    },

    has_lien: function (frm) {
        if (!frm.doc.has_lien) {
            frm.set_value("lienholder", null);
            frm.set_value("lienholder_name", null);
            frm.set_value("lienholder_account", null);
            frm.set_value("lien_payoff_amount", null);
            frm.set_value("lien_payoff_good_through", null);
            frm.set_value("lien_paid_date", null);
            frm.set_value("lien_release_received", 0);
            frm.set_value("lien_release_document", null);
        }
    },

    title_received: function (frm) {
        if (frm.doc.title_received && !frm.doc.title_received_date) {
            frm.set_value(
                "title_received_date",
                frappe.datetime.get_today()
            );
        }
    },

    set_field_indicators: function (frm) {
        if (frm.doc.days_on_lot > 60) {
            frm.set_df_property(
                "days_on_lot",
                "description",
                '<span style="color: red;">Vehicle has been on lot for over 60 days</span>'
            );
        } else if (frm.doc.days_on_lot > 30) {
            frm.set_df_property(
                "days_on_lot",
                "description",
                '<span style="color: orange;">Vehicle has been on lot for over 30 days</span>'
            );
        }

        if (frm.doc.potential_profit < 0) {
            frm.set_df_property(
                "potential_profit",
                "description",
                '<span style="color: red;">Warning: Negative profit margin</span>'
            );
        }
    },
});

frappe.ui.form.on("Vehicle Expense", {
    amount: function (frm, cdt, cdn) {
        frm.trigger("calculate_total_expenses");
    },

    expenses_remove: function (frm) {
        frm.trigger("calculate_total_expenses");
    },

    calculate_total_expenses: function (frm) {
        let total = 0;
        (frm.doc.expenses || []).forEach(function (expense) {
            total += flt(expense.amount);
        });
        frm.set_value("total_investment", total);
        frm.trigger("calculate_potential_profit");
    },
});

frappe.ui.form.on("Vehicle Photo", {
    is_primary: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.is_primary) {
            (frm.doc.photos || []).forEach(function (photo) {
                if (photo.name !== row.name) {
                    frappe.model.set_value(
                        photo.doctype,
                        photo.name,
                        "is_primary",
                        0
                    );
                }
            });
        }
    },
});

frappe.ui.form.on("Vehicle Note", {
    notes_add: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "added_by", frappe.session.user);
        frappe.model.set_value(
            cdt,
            cdn,
            "note_date",
            frappe.datetime.now_datetime()
        );
    },
});
