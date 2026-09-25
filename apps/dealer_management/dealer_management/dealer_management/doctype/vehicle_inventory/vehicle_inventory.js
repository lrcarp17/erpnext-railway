frappe.ui.form.on("Vehicle Inventory", {
  refresh: function (frm) {
    vehicle_view.refresh(frm);
    render_warnings(frm);
    render_upload_button(frm);
    setup_expense_total_refresh(frm);
  },

  onload: function (frm) {
    render_warnings(frm);
  },

  after_save: function (frm) {
    // Saving from the form returns to the read-only overview.
    if (vehicle_view.editing === frm.doc.name) {
      vehicle_view.editing = null;
      frm.refresh();
    }
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

// ---------- Read-only overview ----------

// A saved vehicle opens as a readable overview; the form's sections stay
// hidden until the user chooses Edit. New vehicles go straight to the form.
const vehicle_view = {
  // Name of the vehicle being edited. The form object is shared by every
  // vehicle, so the mode is tracked per document rather than on `frm`.
  editing: null,

  is_viewing(frm) {
    return !frm.is_new() && this.editing !== frm.doc.name;
  },

  refresh(frm) {
    const viewing = this.is_viewing(frm);
    this.tag_sections(frm);
    frm.layout.wrapper.toggleClass("vi-viewing", viewing);
    frm.page.wrapper.toggleClass("vi-viewing-page", viewing);

    const $wrapper = frm.fields_dict.summary_html.$wrapper;
    if (!viewing) {
      $wrapper.empty();
      if (!frm.is_new()) {
        frm.add_custom_button(__("Back to Overview"), () => this.leave_edit(frm));
      }
      return;
    }

    frm.page.clear_primary_action();
    frm.add_custom_button(__("Update from Document"), () => dealer_management.document_import.open(frm));

    this.overview = null;
    this.render(frm);
    const name = frm.doc.name;
    frappe
      .xcall("dealer_management.dealer_management.doctype.vehicle_inventory.vehicle_inventory.get_vehicle_overview", {
        vehicle_name: name,
      })
      .then((overview) => {
        if (frm.doc.name !== name || !this.is_viewing(frm)) return;
        this.overview = overview;
        this.render(frm);
      });
  },

  // Every section except the overview's own is form-only.
  tag_sections(frm) {
    frm.meta.fields.forEach((df) => {
      const field = frm.fields_dict[df.fieldname];
      if (df.fieldtype === "Section Break" && field && field.wrapper) {
        $(field.wrapper).toggleClass("vi-edit-only", df.fieldname !== "summary_section");
      }
    });
  },

  edit(frm, fieldname) {
    this.editing = frm.doc.name;
    frm.refresh();
    if (fieldname) setTimeout(() => frm.scroll_to_field(fieldname), 150);
    else frappe.utils.scroll_to(0);
  },

  leave_edit(frm) {
    const done = () => {
      this.editing = null;
      frm.refresh();
      frappe.utils.scroll_to(0);
    };
    if (frm.is_dirty()) {
      frappe.confirm(__("Discard your unsaved changes?"), () => Promise.resolve(frm.reload_doc()).then(done));
    } else {
      done();
    }
  },

  change_price(frm) {
    const dialog = new frappe.ui.Dialog({
      title: __("Change Price"),
      fields: [
        { fieldname: "asking_price", fieldtype: "Currency", label: __("Asking Price"), default: frm.doc.asking_price, reqd: 1 },
        { fieldname: "floor_price", fieldtype: "Currency", label: __("Floor Price"), default: frm.doc.floor_price },
      ],
      primary_action_label: __("Save"),
      primary_action: (values) => {
        dialog.hide();
        frm.set_value(values).then(() => frm.save());
      },
    });
    dialog.show();
  },

  // ---------- rendering ----------

  render(frm) {
    const doc = frm.doc;
    const o = this.overview || {};
    const loaded = !!this.overview;
    const sold = doc.status === "Sold" || doc.status === "Wholesale";
    const acq = o.acquisition;

    // Cost is recomputed from the acquisition record when there is one, so it
    // stays right even if the acquisition changed after the vehicle was saved.
    const purchase = acq
      ? ["bid_amount", "buyer_fee", "transport_cost", "title_fee", "other_fees"].reduce((t, f) => t + flt(acq[f]), 0)
      : flt(doc.total_investment) - flt(doc.total_expenses);
    const expenses = flt(doc.total_expenses);
    const cost = purchase + expenses;

    const ctx = { frm, doc, o, loaded, sold, acq, purchase, expenses, cost };

    const $w = frm.fields_dict.summary_html.$wrapper;
    $w.html(`
      <div class="vi-view">
        ${this.hero_html(ctx)}
        ${this.alerts_html(ctx)}
        ${this.kpis_html(ctx)}
        <div class="vi-grid vi-grid-2">
          ${this.acquisition_html(ctx)}
          ${this.timeline_html(ctx)}
        </div>
        <div class="vi-grid vi-grid-3-2">
          ${this.details_html(ctx)}
          ${this.title_html(ctx)}
        </div>
        ${this.related_html(ctx)}
        ${this.photos_html(ctx)}
        <div class="vi-grid vi-grid-2">
          ${this.listings_html(ctx)}
          ${this.notes_html(ctx)}
        </div>
        ${this.description_html(ctx)}
      </div>
    `);
    this.bind(frm, $w);
  },

  bind(frm, $w) {
    $w.find("[data-vi-edit]").on("click", (e) => {
      e.preventDefault();
      this.edit(frm, e.currentTarget.dataset.viEdit || null);
    });
    $w.find("[data-vi-action=price]").on("click", () => this.change_price(frm));
    $w.find("[data-vi-action=sale]").on("click", () => frappe.new_doc("Vehicle Sale", { vehicle: frm.doc.name }));
    $w.find("[data-vi-action=acquisition]").on("click", () =>
      frappe.new_doc("Vehicle Acquisition", { vehicle: frm.doc.name })
    );
    $w.find("[data-vi-new]").on("click", (e) =>
      frappe.new_doc(e.currentTarget.dataset.viNew, { vehicle: frm.doc.name })
    );
    $w.find("[data-vi-route]").on("click", (e) => {
      e.preventDefault();
      frappe.set_route(...JSON.parse(e.currentTarget.dataset.viRoute));
    });
    $w.find("[data-vi-photo]").on("click", (e) => {
      e.preventDefault();
      window.open(e.currentTarget.dataset.viPhoto, "_blank", "noopener");
    });
  },

  hero_html({ doc, sold }) {
    const name = [doc.year, doc.make, doc.model, doc.trim].filter(Boolean).join(" ") || doc.name;
    const status = (dealer_management.VEHICLE_STATUS || {})[doc.status];
    const miles = doc.mileage_current || doc.mileage_in;
    const meta = [
      doc.vin && __("VIN {0}", [doc.vin]),
      miles && __("{0} mi", [format_number(miles, null, 0)]),
      doc.exterior_color,
    ].filter(Boolean);
    const photo = this.primary_photo(doc);

    return `
      <header class="vi-hero">
        ${photo ? `<a class="vi-hero-photo" href="#" data-vi-photo="${esc(photo)}"><img src="${esc(photo)}" alt="${esc(name)}"></a>` : ""}
        <div class="vi-hero-main">
          <div class="vi-eyebrow">${esc(doc.stock_number ? __("Stock #{0}", [doc.stock_number]) : doc.name)}${doc.stock_number ? ` · ${esc(doc.name)}` : ""}</div>
          <div class="vi-title-row">
            <h2 class="vi-title">${esc(name)}</h2>
            ${doc.status ? `<span class="vi-pill" style="--vi-pill: ${status ? status.hex : "#64748b"}">${esc(__(doc.status))}</span>` : ""}
          </div>
          ${meta.length ? `<div class="vi-meta">${meta.map(esc).join(" · ")}</div>` : ""}
        </div>
        <div class="vi-hero-actions">
          <button type="button" class="vi-btn" data-vi-action="price">${__("Change price")}</button>
          ${sold ? "" : `<button type="button" class="vi-btn vi-btn-dark" data-vi-action="sale">${__("Record sale")}</button>`}
          <button type="button" class="vi-btn vi-btn-primary" data-vi-edit="">
            ${frappe.utils.icon("edit", "sm")}<span>${__("Edit")}</span>
          </button>
        </div>
      </header>`;
  },

  alerts_html({ o }) {
    const warnings = o.warnings || [];
    if (!warnings.length) return "";
    return `
      <div class="vi-alerts" role="list">
        ${warnings.map((w) => `<span role="listitem" class="vi-alert vi-alert-${esc(w.type)}">${esc(__(w.message))}</span>`).join("")}
      </div>`;
  },

  kpis_html({ doc, o, sold, cost, purchase, expenses, loaded }) {
    const asking = flt(doc.asking_price);
    const history = o.price_history || [];

    const start = doc.lot_date || doc.acquisition_date || (doc.creation || "").slice(0, 10);
    const end = sold && doc.sale_date ? doc.sale_date : frappe.datetime.get_today();
    const days = start ? Math.max(0, frappe.datetime.get_day_diff(end, start)) : null;
    const age_tone = days == null ? "" : days > 60 ? "red" : days >= 30 ? "amber" : "green";
    let age_sub = start ? __("In stock since {0}", [fmt_date(start)]) : __("Set a lot date");
    if (!sold && doc.lot_expiration_date) {
      const left = frappe.datetime.get_day_diff(doc.lot_expiration_date, frappe.datetime.get_today());
      age_sub = left < 0 ? __("Lot expired {0} days ago", [-left]) : __("Lot expires in {0} days", [left]);
    }

    let price_sub = doc.floor_price ? __("Floor {0}", [money(doc.floor_price)]) : __("No floor price");
    if (history.length) {
      const oldest = history[history.length - 1];
      const first = oldest.old || oldest.new;
      const drops = history.filter((h) => h.new < h.old).length;
      if (first && first !== asking) {
        price_sub = `${__("Was")} <s>${esc(money(first))}</s>` + (drops ? ` · ${esc(__(drops === 1 ? "{0} drop" : "{0} drops", [drops]))}` : "");
      }
    }

    // A sold vehicle's real gross comes from its sale, not the asking price.
    const sale = o.sale;
    let gross, gross_label, gross_sub;
    if (sold && sale && sale.sale_price) {
      gross = flt(sale.gross_profit);
      gross_label = __("Gross profit");
      gross_sub = __("Sold for {0} · {1}% on cost", [money(sale.sale_price), Math.round(flt(sale.profit_margin))]);
    } else {
      gross = asking - cost;
      gross_label = __("Projected gross");
      gross_sub = !asking ? __("Set an asking price") : cost ? __("{0}% on cost at asking", [Math.round((gross / cost) * 100)]) : "";
    }

    const book = flt(doc.book_value) || (o.market && flt(o.market.retail_value));
    const book_label = flt(doc.book_value) ? __("Book value") : __("Retail value");
    const book_sub = book && asking
      ? asking >= book
        ? __("Asking {0} over", [money(asking - book)])
        : __("Asking {0} under", [money(book - asking)])
      : loaded ? __("No valuation yet") : "";

    const tile = (label, value, sub, tone, sub_is_html) => `
      <div class="vi-kpi ${tone ? "vi-kpi-" + tone : ""}">
        <div class="vi-kpi-label">${esc(label)}</div>
        <div class="vi-kpi-value">${esc(value)}</div>
        <div class="vi-kpi-sub">${sub_is_html ? sub : esc(sub || "")}</div>
      </div>`;

    return `
      <section class="vi-kpis" aria-label="${__("Key numbers")}">
        ${tile(__("Total cost"), cost ? money(cost) : "–", cost ? __("Purchase {0} + expenses {1}", [money(purchase), money(expenses)]) : __("No costs recorded"))}
        ${tile(__("Asking price"), asking ? money(asking) : "–", price_sub, "", true)}
        ${tile(sold ? __("Days to sell") : __("Days on lot"), days == null ? "–" : format_number(days, null, 0), age_sub, age_tone)}
        ${tile(gross_label, asking || (sale && sale.sale_price) ? money(gross) : "–", gross_sub, !asking && !(sale && sale.sale_price) ? "" : gross < 0 ? "neg" : "pos")}
        ${tile(book_label, book ? money(book) : "–", book_sub)}
      </section>`;
  },

  acquisition_html({ doc, acq, loaded, expenses, cost, purchase }) {
    const head_meta = acq
      ? [
          fmt_date(acq.purchase_date || acq.auction_date),
          acq.auction_name || acq.source_label || acq.seller_name,
          acq.lane_number && __("Lane {0}", [acq.lane_number]),
          acq.auction_id && __("Lot {0}", [acq.auction_id]),
        ].filter(Boolean)
      : [];

    let body;
    if (!loaded) {
      body = `<div class="vi-skel"></div><div class="vi-skel"></div><div class="vi-skel"></div>`;
    } else if (!acq && !purchase && !expenses) {
      body = `
        <div class="vi-empty">
          <p>${__("No acquisition recorded for this vehicle yet.")}</p>
          <button type="button" class="vi-btn" data-vi-action="acquisition">${__("Record acquisition")}</button>
        </div>`;
    } else {
      const rows = [];
      if (acq) {
        rows.push([acq.source_type === "Auction" || acq.auction_name ? __("Hammer price") : __("Purchase price"), acq.bid_amount, true]);
        rows.push([__("Buyer's fee"), acq.buyer_fee]);
        rows.push([__("Transport"), acq.transport_cost]);
        rows.push([__("Title fee"), acq.title_fee]);
        rows.push([__("Other fees"), acq.other_fees]);
      } else {
        rows.push([__("Purchase"), purchase, true]);
      }
      const exp = (doc.expenses || []).slice().sort((a, b) => (b.expense_date || "").localeCompare(a.expense_date || ""));
      const shown = exp.slice(0, 5);
      shown.forEach((e) => {
        const label = [e.is_recon ? __("Recon") : e.category, e.description].filter(Boolean).join(" · ") || __("Expense");
        rows.push([label, e.amount, true]);
      });
      if (exp.length > shown.length) {
        const rest = exp.slice(shown.length).reduce((t, e) => t + flt(e.amount), 0);
        rows.push([__("{0} more expenses", [exp.length - shown.length]), rest, true]);
      }

      body = `
        <dl class="vi-lines">
          ${rows
            .filter(([, v, always]) => always || flt(v))
            .map(([label, v]) => `<div class="vi-line"><dt>${esc(label)}</dt><dd>${esc(money(v))}</dd></div>`)
            .join("")}
          <div class="vi-line vi-line-total"><dt>${__("Total landed cost")}</dt><dd>${esc(money(cost))}</dd></div>
        </dl>
        ${acq && acq.had_existing_lien && flt(acq.lien_payoff_amount)
          ? `<p class="vi-note">${esc(__("Lien payoff of {0} recorded on the acquisition (not included above).", [money(acq.lien_payoff_amount)]))}</p>`
          : ""}
        ${acq && flt(acq.total_estimated_turnover)
          ? `<p class="vi-note">${esc(__("Estimated recon at purchase: {0}", [money(acq.total_estimated_turnover)]))}</p>`
          : ""}`;
    }

    const links = [
      acq ? `<a href="#" data-vi-route='${esc(JSON.stringify(["Form", "Vehicle Acquisition", acq.name]))}'>${__("Open acquisition")} →</a>` : "",
      `<a href="#" data-vi-edit="expenses">+ ${__("Add expense")}</a>`,
    ].filter(Boolean);

    return card(
      __("Acquisition"),
      body + `<div class="vi-card-links">${links.join("")}</div>`,
      head_meta.length ? esc(head_meta.join(" · ")) : ""
    );
  },

  timeline_html({ doc, o, acq, loaded }) {
    const events = [];
    const add = (date, text) => date && events.push({ date: String(date).slice(0, 10), text });

    const bought = (acq && (acq.purchase_date || acq.auction_date)) || doc.acquisition_date;
    add(bought, acq && acq.auction_name ? __("Purchased at {0}", [acq.auction_name]) : __("Purchased"));
    add(doc.lot_date, __("Arrived on lot"));
    add(doc.title_received_date, __("Title received"));
    add(doc.lien_paid_date, __("Lien paid off"));
    (doc.listings || []).forEach((l) =>
      add(l.listed_date, l.listed_price
        ? __("Listed on {0} at {1}", [l.platform || __("a platform"), money(l.listed_price)])
        : __("Listed on {0}", [l.platform || __("a platform")]))
    );
    (o.price_history || []).forEach((h) =>
      add(h.date, h.old ? __("Price changed {0} → {1}", [money(h.old), money(h.new)]) : __("Priced at {0}", [money(h.new)]))
    );
    if (o.condition) add(o.condition.inspection_date, __("Inspected"));
    if (o.sale && o.sale.sale_date) add(o.sale.sale_date, __("Sold for {0}", [money(o.sale.sale_price)]));
    else add(doc.sale_date, __("Sold"));

    events.sort((a, b) => b.date.localeCompare(a.date));
    const shown = events.slice(0, 8);

    const body = !loaded && !shown.length
      ? `<div class="vi-skel"></div><div class="vi-skel"></div>`
      : shown.length
      ? `<ol class="vi-timeline">
          ${shown.map((e) => `<li><span>${esc(e.text)}</span><time datetime="${esc(e.date)}">${esc(fmt_date(e.date, true))}</time></li>`).join("")}
        </ol>`
      : `<div class="vi-empty"><p>${__("Nothing has happened to this vehicle yet.")}</p></div>`;

    return card(__("Timeline"), body);
  },

  details_html({ doc }) {
    const items = [
      [__("Stock #"), doc.stock_number],
      [__("Year"), doc.year],
      [__("Make"), doc.make],
      [__("Model"), doc.model],
      [__("Trim"), doc.trim],
      [__("Body style"), doc.body_style],
      [__("Exterior"), doc.exterior_color],
      [__("Interior"), doc.interior_color],
      [__("Mileage in"), doc.mileage_in && format_number(doc.mileage_in, null, 0)],
      [__("Mileage now"), doc.mileage_current && format_number(doc.mileage_current, null, 0)],
      [__("Engine"), doc.engine],
      [__("Transmission"), doc.transmission],
      [__("Drivetrain"), doc.drivetrain],
      [__("Fuel"), doc.fuel_type],
      [__("Doors"), doc.doors],
      [__("VIN"), doc.vin, "mono"],
    ];
    return card(__("Vehicle details"), facts(items, "vi-facts-4"), "", "year");
  },

  title_html({ doc }) {
    const items = [
      [__("Title status"), doc.title_status],
      [__("Title received"), doc.title_received ? fmt_date(doc.title_received_date) || __("Yes") : __("Not yet")],
      [__("Title location"), doc.title_location],
      [__("Title state"), doc.title_state],
      [__("Title number"), doc.title_number, "mono"],
    ];
    if (doc.has_lien) {
      items.push(
        [__("Lienholder"), doc.lienholder_name || doc.lienholder],
        [__("Payoff"), doc.lien_payoff_amount && money(doc.lien_payoff_amount)],
        [__("Good through"), fmt_date(doc.lien_payoff_good_through)],
        [__("Paid"), fmt_date(doc.lien_paid_date)],
        [__("Release received"), doc.lien_release_received ? __("Yes") : __("Not yet")]
      );
    } else {
      items.push([__("Lien"), __("None")]);
    }
    return card(__("Title & lien"), facts(items, "vi-facts-2"), "", "title_status");
  },

  related_html({ o, loaded, sold }) {
    if (!loaded) return "";
    const cards = [];

    const c = o.condition;
    cards.push(
      c
        ? card(
            __("Condition"),
            facts([
              [__("Overall"), stars(c.overall_rating)],
              [__("Exterior"), stars(c.exterior_rating)],
              [__("Interior"), stars(c.interior_rating)],
              [__("Mechanical"), stars(c.mechanical_rating)],
              [__("Tires"), stars(c.tire_rating)],
              [__("Smog"), c.smog_status],
              [__("Check engine"), c.check_engine_light ? __("On") : __("Off")],
              [__("Damage"), c.has_damage ? __("Yes") : __("None noted")],
            ], "vi-facts-2") + route_link("Vehicle Condition", c.name, __("Open inspection")),
            esc([fmt_date(c.inspection_date), c.inspected_by].filter(Boolean).join(" · "))
          )
        : empty_card(__("Condition"), __("No inspection recorded."), "Vehicle Condition", __("Add inspection"))
    );

    const m = o.market;
    cards.push(
      m
        ? card(
            __("Market value"),
            facts([
              [__("Retail"), m.retail_value && money(m.retail_value)],
              [__("Wholesale"), m.wholesale_value && money(m.wholesale_value)],
              [__("Trade-in"), m.trade_in_value && money(m.trade_in_value)],
              [__("Recommended"), m.recommended_price && money(m.recommended_price)],
              [__("Trend"), m.market_trend],
              [__("Est. days to sell"), m.days_to_sell_estimate],
            ], "vi-facts-2") + route_link("Vehicle Market Info", m.name, __("Open valuation")),
            esc(fmt_date(m.info_date))
          )
        : empty_card(__("Market value"), __("No valuation recorded."), "Vehicle Market Info", __("Add valuation"))
    );

    const s = o.sale;
    if (s || sold) {
      cards.push(
        s
          ? card(
              __("Sale"),
              facts([
                [__("Buyer"), s.buyer_name],
                [__("Sale price"), s.sale_price && money(s.sale_price)],
                [__("Gross profit"), money(s.gross_profit)],
                [__("Net profit"), money(s.net_profit)],
              ], "vi-facts-2") + route_link("Vehicle Sale", s.name, __("Open sale")),
              esc(fmt_date(s.sale_date))
            )
          : empty_card(__("Sale"), __("Marked sold, but no sale is recorded."), "Vehicle Sale", __("Record sale"))
      );
    }

    return `<div class="vi-grid vi-grid-${cards.length}">${cards.join("")}</div>`;
  },

  photos_html({ doc }) {
    const photos = (doc.photos || []).filter((p) => p.photo);
    const body = photos.length
      ? `<div class="vi-photos">
          ${photos
            .slice(0, 12)
            .map((p) => `<a href="#" data-vi-photo="${esc(p.photo)}"><img src="${esc(p.photo)}" alt="${esc(p.caption || p.photo_type || "")}" loading="lazy"></a>`)
            .join("")}
        </div>
        ${photos.length > 12 ? `<p class="vi-note">${esc(__("{0} more photos", [photos.length - 12]))}</p>` : ""}`
      : `<div class="vi-empty"><p>${__("No photos yet.")}</p><button type="button" class="vi-btn" data-vi-edit="photos">${__("Add photos")}</button></div>`;
    return card(__("Photos"), body, photos.length ? esc(__("{0} photos", [photos.length])) : "", "photos");
  },

  listings_html({ doc }) {
    const listings = doc.listings || [];
    const body = listings.length
      ? `<div class="vi-table-wrap"><table class="vi-table">
          <thead><tr><th>${__("Platform")}</th><th>${__("Status")}</th><th class="vi-num">${__("Price")}</th><th class="vi-num">${__("Views")}</th><th class="vi-num">${__("Leads")}</th></tr></thead>
          <tbody>
            ${listings
              .map((l) => `<tr>
                <td>${l.listing_url ? `<a href="${esc(safe_url(l.listing_url))}" target="_blank" rel="noopener">${esc(l.platform || __("Listing"))}</a>` : esc(l.platform || "")}</td>
                <td>${esc(l.status || "")}</td>
                <td class="vi-num">${l.listed_price ? esc(money(l.listed_price)) : "–"}</td>
                <td class="vi-num">${l.views != null ? esc(format_number(l.views, null, 0)) : "–"}</td>
                <td class="vi-num">${l.inquiries != null ? esc(format_number(l.inquiries, null, 0)) : "–"}</td>
              </tr>`)
              .join("")}
          </tbody>
        </table></div>`
      : `<div class="vi-empty"><p>${__("Not listed anywhere yet.")}</p></div>`;
    return card(__("Listings"), body, "", "listings");
  },

  notes_html({ doc }) {
    const notes = (doc.notes || []).slice().sort((a, b) => (b.note_date || "").localeCompare(a.note_date || ""));
    const body = notes.length
      ? `<ul class="vi-notes">
          ${notes
            .slice(0, 5)
            .map((n) => `<li>
              <p>${esc(n.note || "")}</p>
              <span>${esc([n.note_type, fmt_date(n.note_date), n.added_by && frappe.user.full_name(n.added_by)].filter(Boolean).join(" · "))}</span>
            </li>`)
            .join("")}
        </ul>`
      : `<div class="vi-empty"><p>${__("No notes yet.")}</p></div>`;
    return card(__("Notes"), body, "", "notes");
  },

  description_html({ doc }) {
    if (!doc.features && !doc.description) return "";
    return card(
      __("Description"),
      `${doc.features ? `<p class="vi-features">${esc(doc.features)}</p>` : ""}
       ${doc.description ? `<div class="vi-description">${frappe.dom.remove_script_and_style(doc.description)}</div>` : ""}`,
      "",
      "features"
    );
  },

  primary_photo(doc) {
    const photos = (doc.photos || []).filter((p) => p.photo);
    const primary = photos.find((p) => p.is_primary) || photos[0];
    return primary ? primary.photo : null;
  },
};

// ---------- small rendering helpers ----------

function esc(value) {
  return frappe.utils.escape_html(value == null ? "" : String(value));
}

function money(value) {
  return format_currency(flt(value), dealer_management.currency_code ? dealer_management.currency_code() : null, 0);
}

function fmt_date(value, short) {
  if (!value) return "";
  const m = moment(String(value).slice(0, 10));
  if (!m.isValid()) return "";
  return short && m.year() === moment().year() ? m.format("MMM D") : m.format("MMM D, YYYY");
}

function stars(rating) {
  // Rating fields store 0–1; show them out of five.
  const n = Math.round(flt(rating) * 5);
  return n ? `${n}/5` : null;
}

function safe_url(url) {
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}

function card(title, body, meta, edit_field) {
  return `
    <section class="vi-card">
      <div class="vi-card-head">
        <h3>${esc(title)}</h3>
        <div class="vi-card-meta">
          ${meta ? `<span>${meta}</span>` : ""}
          ${edit_field ? `<a href="#" class="vi-card-edit" data-vi-edit="${esc(edit_field)}">${__("Edit")}</a>` : ""}
        </div>
      </div>
      ${body}
    </section>`;
}

function empty_card(title, message, doctype, action) {
  return card(
    title,
    `<div class="vi-empty"><p>${esc(message)}</p>
      <button type="button" class="vi-btn" data-vi-new="${esc(doctype)}">${esc(action)}</button></div>`
  );
}

function route_link(doctype, name, label) {
  return `<div class="vi-card-links"><a href="#" data-vi-route='${esc(JSON.stringify(["Form", doctype, name]))}'>${esc(label)} →</a></div>`;
}

// [label, value, class] triples as a definition grid; empty values show a dash.
function facts(items, cls) {
  return `<dl class="vi-facts ${cls || ""}">
    ${items
      .map(([label, value, extra]) => {
        const empty = value == null || value === "" || value === 0;
        return `<div><dt>${esc(label)}</dt><dd class="${empty ? "vi-muted" : ""} ${extra || ""}">${empty ? "–" : esc(value)}</dd></div>`;
      })
      .join("")}
  </dl>`;
}

// ---------- form helpers ----------

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
