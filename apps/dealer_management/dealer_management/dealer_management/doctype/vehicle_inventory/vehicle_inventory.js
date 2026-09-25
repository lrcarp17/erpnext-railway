frappe.ui.form.on("Vehicle Inventory", {
  refresh: function (frm) {
    render_summary(frm);
    render_warnings(frm);
    render_upload_button(frm);
    setup_expense_total_refresh(frm);
  },

  onload: function (frm) {
    render_warnings(frm);
  },

  title_received: function (frm) {
    render_warnings(frm);
  },

  acquisition: function (frm) {
    render_warnings(frm);
  },

  asking_price: function (frm) {
    render_summary(frm);
    render_warnings(frm);
  },

  has_lien: function (frm) {
    render_warnings(frm);
  },

  lien_release_received: function (frm) {
    render_warnings(frm);
  },

  status: function (frm) {
    render_warnings(frm);
  },

  floor_price: render_summary,
  book_value: render_summary,
  lot_date: render_summary,
  lot_expiration_date: render_summary,
  mileage_current: render_summary,
  total_expenses: render_summary,
});

frappe.ui.form.on("Vehicle Expense", {
  amount: function (frm) {
    calculate_expense_total(frm);
  },
  expenses_remove: function (frm) {
    calculate_expense_total(frm);
  },
});

frappe.ui.form.on("Vehicle Photo", {
  photos_add: function (frm) {
    render_warnings(frm);
  },
  photos_remove: function (frm) {
    render_warnings(frm);
  },
});

// ---------- Summary dashboard ----------

// Figures a dealer checks first: age on the lot, price, cost and profit.
// Age is computed live (days_on_lot is only refreshed on save), using the same
// fallbacks as the home page's aging buckets.
function render_summary(frm) {
  const $wrapper = frm.fields_dict.summary_html.$wrapper;
  if (frm.is_new()) {
    $wrapper.html("");
    return;
  }

  const doc = frm.doc;
  // Purchase cost is the saved investment less saved expenses; kept aside so
  // editing the expenses table updates the total before the vehicle is saved.
  if (!frm.__summary_cost || frm.__summary_cost.name !== doc.name || !frm.is_dirty()) {
    frm.__summary_cost = {
      name: doc.name,
      purchase: flt(doc.total_investment) - flt(doc.total_expenses),
    };
  }
  const purchase = frm.__summary_cost.purchase;
  const expenses = flt(doc.total_expenses);
  const cost = purchase + expenses;
  const asking = flt(doc.asking_price);
  const sold = doc.status === "Sold" || doc.status === "Wholesale";

  const start = doc.lot_date || doc.acquisition_date || (doc.creation || "").slice(0, 10);
  const end = sold && doc.sale_date ? doc.sale_date : frappe.datetime.get_today();
  const days = start ? Math.max(0, frappe.datetime.get_day_diff(end, start)) : null;
  const age_tone = days == null ? "" : days > 90 ? "red" : days > 60 ? "orange" : days > 30 ? "yellow" : "green";

  const money = (v) => format_currency(v, vehicle_currency(), 0);
  const date = (d) => frappe.datetime.str_to_user(d);

  let lot_sub = start ? __("Since {0}", [date(start)]) : __("Set a lot date");
  if (!sold && doc.lot_expiration_date) {
    const left = frappe.datetime.get_day_diff(doc.lot_expiration_date, frappe.datetime.get_today());
    lot_sub = left < 0
      ? __("Lot expired {0} days ago", [-left])
      : __("Lot expires in {0} days", [left]);
  }

  const profit = asking - cost;
  // Same basis as Vehicle Sale: profit as a percentage of total cost.
  const margin = asking && cost ? Math.round((profit / cost) * 100) : null;

  const tiles = [
    {
      label: sold ? __("Days to Sell") : __("Days on Lot"),
      value: days == null ? "–" : format_number(days, null, 0),
      sub: lot_sub,
      tone: age_tone,
    },
    {
      label: __("Asking Price"),
      value: asking ? money(asking) : "–",
      sub: doc.floor_price ? __("Floor {0}", [money(doc.floor_price)]) : __("No floor price"),
    },
    {
      label: __("Total Cost"),
      value: cost ? money(cost) : "–",
      sub: __("Purchase {0} + expenses {1}", [money(purchase), money(expenses)]),
    },
    {
      label: sold ? __("Profit") : __("Potential Profit"),
      value: asking || cost ? money(profit) : "–",
      sub: !asking ? __("Set an asking price") : margin == null ? "" : __("{0}% on cost", [margin]),
      tone: !asking ? "" : profit < 0 ? "red" : "green",
      key: "profit",
    },
    {
      label: __("Book Value"),
      value: doc.book_value ? money(doc.book_value) : "–",
      sub: doc.book_value && asking
        ? (asking >= doc.book_value
          ? __("Asking {0} over book", [money(asking - doc.book_value)])
          : __("Asking {0} under book", [money(doc.book_value - asking)]))
        : "",
    },
    {
      label: __("Mileage"),
      value: doc.mileage_current || doc.mileage_in
        ? format_number(doc.mileage_current || doc.mileage_in, null, 0)
        : "–",
      sub: doc.mileage_in && doc.mileage_current && doc.mileage_current !== doc.mileage_in
        ? __("{0} since intake", [format_number(doc.mileage_current - doc.mileage_in, null, 0)])
        : "",
    },
  ];

  const esc = frappe.utils.escape_html;
  $wrapper.html(`
    <div class="vi-summary">
      ${tiles
        .map(
          (t) => `
        <div class="vi-tile ${t.tone ? "vi-tone-" + t.tone : ""}" ${t.key ? `data-key="${t.key}"` : ""}>
          <div class="vi-label">${esc(t.label)}</div>
          <div class="vi-value">${esc(t.value)}</div>
          <div class="vi-sub">${esc(t.sub || "")}</div>
        </div>`
        )
        .join("")}
    </div>
  `);

  // A sold vehicle's real profit comes from its sale, not the asking price.
  if (sold && doc.sale) {
    frappe.db.get_value("Vehicle Sale", doc.sale, ["sale_price", "gross_profit", "profit_margin"]).then((r) => {
      const sale = r.message;
      if (!sale || !sale.sale_price) return;
      const $tile = $wrapper.find('[data-key="profit"]');
      const gross = flt(sale.gross_profit);
      $tile.removeClass("vi-tone-red vi-tone-green").addClass(gross < 0 ? "vi-tone-red" : "vi-tone-green");
      $tile.find(".vi-value").text(money(gross));
      $tile.find(".vi-sub").text(__("Sold for {0} · {1}% on cost", [money(sale.sale_price), Math.round(flt(sale.profit_margin))]));
    });
  }
}

function vehicle_currency() {
  return (window.dealer_management && dealer_management.currency_code && dealer_management.currency_code()) ||
    frappe.defaults.get_default("currency");
}

function render_warnings(frm) {
  if (frm.is_new()) {
    frm.fields_dict.warnings_html.$wrapper.html(`
      <div class="vehicle-warnings">
        <div class="alert alert-info">
          <span class="indicator-pill blue">New</span>
          Save the vehicle to see alerts
        </div>
      </div>
    `);
    return;
  }

  frappe.call({
    method:
      "dealer_management.dealer_management.doctype.vehicle_inventory.vehicle_inventory.get_vehicle_warnings",
    args: { vehicle_name: frm.doc.name },
    callback: function (r) {
      if (r.message) {
        display_warnings(frm, r.message);
      }
    },
  });
}

function display_warnings(frm, warnings) {
  let html = '<div class="vehicle-warnings">';

  if (warnings.length === 0) {
    html += `
      <div class="alert alert-success" style="margin-bottom: 0;">
        <span class="indicator-pill green">Ready</span>
        All checks passed
      </div>
    `;
  } else {
    warnings.forEach((w) => {
      const alertClass =
        w.type === "danger"
          ? "alert-danger"
          : w.type === "warning"
          ? "alert-warning"
          : "alert-info";
      const pillClass =
        w.type === "danger" ? "red" : w.type === "warning" ? "orange" : "blue";

      html += `
        <div class="alert ${alertClass}" style="margin-bottom: 8px; padding: 8px 12px;">
          <span class="indicator-pill ${pillClass}" style="margin-right: 8px;"></span>
          ${w.message}
        </div>
      `;
    });
  }

  html += "</div>";
  html += `
    <style>
      .vehicle-warnings {
        margin-bottom: 15px;
      }
      .vehicle-warnings .alert {
        display: flex;
        align-items: center;
        font-size: 13px;
      }
    </style>
  `;

  frm.fields_dict.warnings_html.$wrapper.html(html);
}

function render_upload_button(frm) {
  if (frm.is_new()) {
    frm.fields_dict.upload_photos_html.$wrapper.html("");
    return;
  }

  frm.fields_dict.upload_photos_html.$wrapper.html(`
    <button class="btn btn-default btn-sm btn-upload-photos" style="margin-bottom: 10px;">
      <svg class="icon icon-sm"><use href="#icon-upload"></use></svg>
      Upload Multiple Photos
    </button>
  `);

  frm.fields_dict.upload_photos_html.$wrapper
    .find(".btn-upload-photos")
    .on("click", function () {
      open_photo_upload_dialog(frm);
    });
}

function open_photo_upload_dialog(frm) {
  new frappe.ui.FileUploader({
    doctype: frm.doctype,
    docname: frm.docname,
    folder: "Home/Attachments",
    allow_multiple: true,
    restrictions: {
      allowed_file_types: ["image/*"],
    },
    on_success: function (file_doc) {
      if (file_doc && file_doc.file_url) {
        let row = frm.add_child("photos", {
          photo: file_doc.file_url,
          photo_type: "Exterior",
        });
        frm.refresh_field("photos");
        frm.dirty();
      }
    },
    as_dataurl: false,
    make_attachments_public: true,
    upload_notes: "Upload vehicle photos (JPG, PNG). Photos will be added to the list below.",
  });
}

function setup_expense_total_refresh(frm) {
  calculate_expense_total(frm);
}

function calculate_expense_total(frm) {
  let total = 0;
  (frm.doc.expenses || []).forEach((row) => {
    total += flt(row.amount);
  });
  frm.set_value("total_expenses", total);
}
