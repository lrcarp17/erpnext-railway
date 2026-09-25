frappe.ui.form.on("Dealer Vehicle", {
  refresh: function (frm) {
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
      "dealer_management.dealer_management.doctype.dealer_vehicle.dealer_vehicle.get_vehicle_warnings",
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
