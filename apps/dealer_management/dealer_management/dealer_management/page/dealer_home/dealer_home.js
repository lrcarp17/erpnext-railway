// Dealerbase home: where users land after signing in. It is the way into every
// part of the app, with a short overview of the business underneath.
frappe.pages["dealer-home"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Home"),
		single_column: true,
	});

	page.set_primary_action(__("Add Vehicle"), () => frappe.new_doc("Vehicle Inventory"), "add");
	page.set_secondary_action(__("Import Document"), () => dealer_management.document_import.open());
	page.add_menu_item(__("Refresh"), () => wrapper.dealer_home.refresh());

	wrapper.dealer_home = new DealerHome(page);
};

frappe.pages["dealer-home"].on_page_show = function (wrapper) {
	// Coming back from a form should show the numbers that form just changed.
	if (wrapper.dealer_home && wrapper.dealer_home.loaded) wrapper.dealer_home.refresh();
};

class DealerHome {
	constructor(page) {
		this.page = page;
		this.$root = $(`<div class="db-home"></div>`).appendTo(page.main);
		this.render_skeleton();
		this.refresh();
	}

	refresh() {
		return frappe.call({ method: "dealer_management.dashboard_api.get_dashboard_data" }).then(
			(r) => {
				this.loaded = true;
				this.data = r.message || {};
				this.render();
			},
			() => {
				this.$root.html(
					`<div class="db-card db-error">${__("We couldn't load your dashboard. Please refresh to try again.")}</div>`
				);
			}
		);
	}

	// ---------- helpers ----------

	esc(value) {
		return frappe.utils.escape_html(value == null ? "" : String(value));
	}

	money(value) {
		return dealer_management.compact_currency(value);
	}

	delta(current, previous) {
		current = flt(current);
		previous = flt(previous);
		if (!previous) return current ? { cls: "up", text: __("New this month") } : null;
		const pct = Math.round(((current - previous) / previous) * 100);
		if (pct === 0) return { cls: "flat", text: __("Same as last month") };
		return {
			cls: pct > 0 ? "up" : "down",
			text: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}% ${__("vs last month")}`,
		};
	}

	greeting() {
		const hour = new Date().getHours();
		if (hour < 12) return __("Good morning");
		if (hour < 18) return __("Good afternoon");
		return __("Good evening");
	}

	first_name() {
		const full = frappe.session.user_fullname || "";
		return full.split(" ")[0] || full;
	}

	icon(name) {
		return frappe.utils.icon(name, "md");
	}

	// ---------- layout ----------

	render_skeleton() {
		const block = (cls) => `<div class="db-skel ${cls}"></div>`;
		this.$root.html(`
			<div class="db-hero">${block("db-skel-title")}${block("db-skel-line")}</div>
			<div class="db-kpis">${[1, 2, 3, 4].map(() => block("db-skel-card")).join("")}</div>
			${block("db-skel-wide")}
		`);
	}

	render() {
		const d = this.data;
		const inv = d.inventory || {};
		const has_sales = d.sales && d.sales.this_year && d.sales.this_year.count;
		const is_empty = !inv.total && !has_sales;
		const aging = this.aging_html(d.aging || [], inv);

		this.$root.html(`
			${this.hero_html(inv, d.leads)}
			${is_empty ? this.onboarding_html() : ""}
			${this.nav_html(d)}
			<h2 class="db-section-title">${__("At a glance")}</h2>
			<div class="db-kpis">${this.kpis_html(inv, d.sales)}</div>
			${this.pipeline_html(d.status_breakdown || [], inv.total)}
			<div class="db-grid db-grid-2-1">
				${this.recent_vehicles_html(d.recent_vehicles || [])}
				${d.leads ? this.follow_ups_html(d.leads) : aging}
			</div>
			${
				d.sales
					? `<div class="db-grid db-grid-2-1">${this.trend_card_html(d.sales)}${d.leads ? aging : ""}</div>`
					: d.leads
					? aging
					: ""
			}
		`);

		if (d.sales) this.render_trend_chart(d.sales.trend || []);
		this.bind_events();
		this.restore_search();
	}

	hero_html(inv, leads) {
		const date = frappe.datetime.str_to_user(frappe.datetime.get_today());
		const bits = [];
		if (inv.total) bits.push(__("{0} units in stock", [inv.total]));
		if (leads && leads.follow_ups_due)
			bits.push(__("{0} follow-ups due", [leads.follow_ups_due]));
		if (inv.problem) bits.push(__("{0} flagged as problem", [inv.problem]));
		const summary = bits.length
			? bits.map((b) => this.esc(b)).join(" · ")
			: __("Here's what's happening at your dealership.");

		return `
			<div class="db-hero">
				<div>
					<div class="db-eyebrow">${this.esc(date)}</div>
					<h1 class="db-hero-title">${this.esc(this.greeting())}, ${this.esc(this.first_name())}</h1>
					<p class="db-hero-sub">${summary}</p>
				</div>
				<label class="db-search">
					${frappe.utils.icon("search", "sm")}
					<input type="search" class="db-search-input" placeholder="${__("Jump to… vehicles, leads, expenses")}"
						aria-label="${__("Find a feature")}" autocomplete="off">
				</label>
			</div>`;
	}

	// ---------- navigation ----------

	nav_sections(d) {
		const inv = d.inventory || {};
		const nav = d.nav || {};
		const leads = d.leads;
		const sales = d.sales;
		const n = (v) => format_number(v || 0, null, 0);
		const counted = (doctype, label) => (nav[doctype] != null ? __(label, [n(nav[doctype])]) : null);
		const expenses = nav["Company Expense"];

		return [
			{
				title: __("Inventory"),
				tiles: [
					{
						label: __("Vehicles"), icon: "car-front", tone: "indigo", doctype: "Vehicle Inventory", create: true,
						desc: __("Every unit from pickup to sale"),
						stat: __("{0} in stock", [n(inv.total)]),
						route: ["List", "Vehicle Inventory", { status: ["not in", ["Sold", "Wholesale"]] }],
					},
					{
						label: __("Acquisitions"), icon: "gavel", tone: "orange", doctype: "Vehicle Acquisition", create: true,
						desc: __("Auction buys, trade-ins and purchases"),
						stat: counted("Vehicle Acquisition", "{0} this month"),
					},
					{
						label: __("Inspections"), icon: "clipboard-check", tone: "cyan", doctype: "Vehicle Condition", create: true,
						desc: __("Condition reports and smog status"),
						stat: counted("Vehicle Condition", "{0} reports"),
					},
					{
						label: __("Market Values"), icon: "tag", tone: "violet", doctype: "Vehicle Market Info", create: true,
						desc: __("Retail, wholesale and trade-in values"),
						stat: counted("Vehicle Market Info", "{0} valuations"),
					},
				],
			},
			{
				title: __("Sales & Customers"),
				tiles: [
					{
						label: __("Leads"), icon: "users", tone: "blue", doctype: "Dealer Lead", create: true,
						desc: __("Prospects, follow-ups and appointments"),
						stat: leads ? __("{0} open", [n(leads.open)]) : null,
						badge: leads && leads.follow_ups_due ? __("{0} due", [leads.follow_ups_due]) : null,
					},
					{
						label: __("Sales"), icon: "handshake", tone: "green", doctype: "Vehicle Sale", create: true,
						desc: __("Deals, financing and gross profit"),
						stat: sales ? __("{0} this month", [n(sales.this_month.count)]) : null,
					},
					{
						label: __("Expenses"), icon: "receipt", tone: "rose", doctype: "Company Expense", create: true,
						desc: __("Rent, payroll, fees and other overhead"),
						stat: expenses ? __("{0} this month", [this.money(expenses.total)]) : null,
					},
				],
			},
			{
				title: __("AI Tools"),
				tiles: [
					{
						label: __("Inventory Assistant"), icon: "sparkles", tone: "ai",
						desc: __("Ask questions and update vehicles in plain English"),
						route: ["inventory-assistant"],
						stat: __("Open chat"),
					},
					{
						label: __("Import Document"), icon: "file-scan", tone: "ai", doctype: "Vehicle Inventory",
						desc: __("Read a title, bill of sale or auction report"),
						action: "import",
						stat: __("Upload a file"),
					},
				],
			},
		];
	}

	setup_links() {
		return [
			{ label: __("Acquisition Sources"), icon: "map-pin", doctype: "Acquisition Source" },
			{ label: __("Listing Platforms"), icon: "megaphone", doctype: "Listing Platform" },
			{ label: __("Lienholders"), icon: "landmark", doctype: "Lienholder" },
			{ label: __("Expense Categories"), icon: "folder-tree", doctype: "Expense Category" },
			{ label: __("AI Settings"), icon: "settings", doctype: "AI Settings", single: true },
			{ label: __("Document Import Settings"), icon: "sliders-horizontal", doctype: "Document Import Settings", single: true },
			{ label: __("AI Usage Log"), icon: "gauge", doctype: "AI Usage Log" },
		].filter((l) => frappe.model.can_read(l.doctype));
	}

	nav_html(d) {
		const sections = this.nav_sections(d)
			.map((section) => ({
				...section,
				tiles: section.tiles.filter((t) => !t.doctype || frappe.model.can_read(t.doctype)),
			}))
			.filter((section) => section.tiles.length);

		const tile = (t) => {
			const route = t.route || ["List", t.doctype];
			const can_create = t.create && frappe.model.can_create(t.doctype);
			const search = [t.label, t.desc, t.doctype].filter(Boolean).join(" ").toLowerCase();
			const target = t.action
				? `data-action="${t.action}"`
				: `data-route='${this.esc(JSON.stringify(route))}'`;
			return `
				<div class="db-tile" tabindex="0" role="link" data-search="${this.esc(search)}" ${target}>
					<div class="db-tile-top">
						<span class="db-tile-icon db-tone-${t.tone}">${this.icon(t.icon)}</span>
						${t.badge ? `<span class="db-badge db-badge-amber">${this.esc(t.badge)}</span>` : ""}
						${
							can_create
								? `<button class="db-tile-new" data-new="${this.esc(t.doctype)}"
									title="${this.esc(__("New {0}", [__(t.doctype)]))}">
									${frappe.utils.icon("plus", "sm")}<span>${__("New")}</span></button>`
								: ""
						}
					</div>
					<div class="db-tile-label">${this.esc(t.label)}</div>
					<div class="db-tile-desc">${this.esc(t.desc)}</div>
					${t.stat ? `<div class="db-tile-stat">${this.esc(t.stat)} <span aria-hidden="true">→</span></div>` : ""}
				</div>`;
		};

		const setup = this.setup_links();
		const setup_html = setup.length
			? `<div class="db-nav-group">
				<div class="db-nav-title">${__("Setup")}</div>
				<div class="db-setup-links">
					${setup
						.map((l) => {
							const route = l.single ? ["Form", l.doctype] : ["List", l.doctype];
							return `<a class="db-setup-link" href="#" data-search="${this.esc(l.label.toLowerCase())}"
								data-route='${this.esc(JSON.stringify(route))}'>${this.icon(l.icon)}<span>${this.esc(l.label)}</span></a>`;
						})
						.join("")}
				</div>
			</div>`
			: "";

		return `
			<nav class="db-nav" aria-label="${__("Dealerbase features")}">
				${sections
					.map(
						(section) => `
					<div class="db-nav-group">
						<div class="db-nav-title">${this.esc(section.title)}</div>
						<div class="db-tiles">${section.tiles.map(tile).join("")}</div>
					</div>`
					)
					.join("")}
				${setup_html}
				<div class="db-empty db-nav-none" hidden>${__("Nothing matches that search.")}</div>
			</nav>`;
	}

	filter_nav(query) {
		query = (query || "").trim().toLowerCase();
		const $items = this.$root.find(".db-tile, .db-setup-link");
		$items.each((_, el) => {
			el.hidden = !!query && !el.dataset.search.includes(query);
		});
		this.$root.find(".db-nav-group").each((_, group) => {
			group.hidden = !$(group).find(".db-tile:not([hidden]), .db-setup-link:not([hidden])").length;
		});
		this.$root.find(".db-nav-none").prop("hidden", !query || $items.filter(":not([hidden])").length > 0);
	}

	restore_search() {
		// A refresh re-renders the page; keep what the user had typed.
		this.$root.find(".db-search-input").val(this.search_query || "");
		if (this.search_query) this.filter_nav(this.search_query);
	}

	onboarding_html() {
		const step = (n, title, body, action, cta) => `
			<div class="db-step">
				<div class="db-step-num">${n}</div>
				<div class="db-step-body">
					<div class="db-step-title">${this.esc(title)}</div>
					<div class="db-step-text">${this.esc(body)}</div>
				</div>
				<button class="btn btn-sm btn-default" data-action="${action}">${this.esc(cta)}</button>
			</div>`;
		return `
			<div class="db-card db-onboarding">
				<div class="db-card-head">
					<div>
						<div class="db-card-title">${__("Welcome to Dealerbase")}</div>
						<div class="db-card-sub">${__("Three quick steps and your dashboard comes to life.")}</div>
					</div>
				</div>
				<div class="db-steps">
					${step(1, __("Add your first vehicle"), __("Enter a VIN or fill in the details by hand."), "add-vehicle", __("Add Vehicle"))}
					${step(2, __("Import from a document"), __("Upload a title, bill of sale or auction report and let AI fill it in."), "import", __("Import"))}
					${step(3, __("Connect AI"), __("Add your API key to enable document import and the inventory assistant."), "ai-settings", __("Open Settings"))}
				</div>
			</div>`;
	}

	kpi(label, value, icon, tone, foot, route) {
		const foot_html = foot
			? typeof foot === "string"
				? `<div class="db-kpi-foot">${this.esc(foot)}</div>`
				: `<div class="db-kpi-foot db-delta-${foot.cls}">${this.esc(foot.text)}</div>`
			: `<div class="db-kpi-foot">&nbsp;</div>`;
		return `
			<div class="db-card db-kpi ${route ? "db-clickable" : ""}" ${route ? `data-route='${this.esc(JSON.stringify(route))}'` : ""}>
				<div class="db-kpi-top">
					<span class="db-kpi-label">${this.esc(label)}</span>
					<span class="db-kpi-icon db-tone-${tone}">${this.icon(icon)}</span>
				</div>
				<div class="db-kpi-value">${this.esc(value)}</div>
				${foot_html}
			</div>`;
	}

	kpis_html(inv, sales) {
		const open_filter = { status: ["not in", ["Sold", "Wholesale"]] };
		const cards = [
			this.kpi(
				__("Units in Stock"),
				format_number(inv.total || 0, null, 0),
				"car-front",
				"indigo",
				__("{0} at asking", [this.money(inv.total_asking_value)]),
				["List", "Vehicle Inventory", open_filter]
			),
			this.kpi(
				__("Front-line Ready"),
				format_number(inv.frontline_ready || 0, null, 0),
				"circle-check",
				"green",
				__("Avg {0} days on lot", [inv.avg_days_on_lot || 0]),
				["List", "Vehicle Inventory", { status: ["in", ["Frontline", "Available"]] }]
			),
		];

		if (sales) {
			const tm = sales.this_month || {};
			const lm = sales.last_month || {};
			cards.push(
				this.kpi(
					__("Sold This Month"),
					format_number(tm.count || 0, null, 0),
					"trending-up",
					"blue",
					this.delta(tm.count, lm.count),
					["List", "Vehicle Sale"]
				),
				this.kpi(
					__("Revenue This Month"),
					this.money(tm.revenue),
					"dollar-sign",
					"violet",
					tm.gross_profit
						? __("{0} gross profit", [this.money(tm.gross_profit)])
						: this.delta(tm.revenue, lm.revenue),
					["List", "Vehicle Sale"]
				)
			);
		} else {
			cards.push(
				this.kpi(
					__("Potential Profit"),
					this.money(inv.potential_profit),
					"dollar-sign",
					"violet",
					__("Asking minus investment")
				),
				this.kpi(
					__("In Recon"),
					format_number(inv.in_recon || 0, null, 0),
					"wrench",
					"blue",
					null,
					["List", "Vehicle Inventory", { status: "In Recon" }]
				)
			);
		}
		return cards.join("");
	}

	pipeline_html(breakdown, total) {
		const colors = dealer_management.VEHICLE_STATUS;
		const segments = breakdown
			.filter((s) => s.count)
			.map(
				(s) => `<div class="db-pipe-seg" style="flex:${s.count};background:${colors[s.status].hex}"
					title="${this.esc(s.status)}: ${s.count}"></div>`
			)
			.join("");
		const stages = breakdown
			.map(
				(s) => `
				<button class="db-stage ${s.count ? "" : "db-stage-empty"}" data-status="${this.esc(s.status)}">
					<span class="db-dot" style="background:${colors[s.status].hex}"></span>
					<span class="db-stage-label">${this.esc(__(s.status))}</span>
					<span class="db-stage-count">${s.count}</span>
				</button>`
			)
			.join("");
		return `
			<div class="db-card">
				<div class="db-card-head">
					<div>
						<div class="db-card-title">${__("Inventory Pipeline")}</div>
						<div class="db-card-sub">${__("Where every open unit is, from pickup to pending sale")}</div>
					</div>
					<a class="db-link" data-route='${this.esc(JSON.stringify(["List", "Vehicle Inventory"]))}'>${__("View all")} →</a>
				</div>
				<div class="db-pipe-bar">${total ? segments : `<div class="db-pipe-seg db-pipe-empty" style="flex:1"></div>`}</div>
				<div class="db-stages">${stages}</div>
			</div>`;
	}

	trend_card_html(sales) {
		const ytd = sales.this_year || {};
		return `
			<div class="db-card">
				<div class="db-card-head">
					<div>
						<div class="db-card-title">${__("Sales Revenue")}</div>
						<div class="db-card-sub">${__("Last 6 months")}</div>
					</div>
					<div class="db-head-stat">
						<div class="db-head-stat-value">${this.esc(this.money(ytd.revenue))}</div>
						<div class="db-head-stat-label">${__("{0} units year to date", [ytd.count || 0])}</div>
					</div>
				</div>
				<div class="db-trend-chart"></div>
			</div>`;
	}

	render_trend_chart(trend) {
		const el = this.$root.find(".db-trend-chart").get(0);
		if (!el) return;
		if (!trend.some((t) => t.revenue)) {
			$(el).html(
				`<div class="db-empty">${__("Sales you record will chart here month by month.")}</div>`
			);
			return;
		}
		try {
			this.draw_trend_chart(el, trend);
		} catch (e) {
			console.error(e);
			$(el).html(`<div class="db-empty">${__("The sales chart could not be drawn.")}</div>`);
		}
	}

	draw_trend_chart(el, trend) {
		new frappe.Chart(el, {
			type: "bar",
			height: 240,
			colors: ["#6366f1"],
			barOptions: { spaceRatio: 0.45 },
			axisOptions: { xAxisMode: "tick", yAxisMode: "span", xIsSeries: true, shortenYAxisNumbers: 1 },
			data: {
				labels: trend.map((t) => t.label),
				datasets: [{ name: __("Revenue"), values: trend.map((t) => t.revenue) }],
			},
			tooltipOptions: {
				formatTooltipY: (v) => dealer_management.full_currency(v),
			},
		});
	}

	aging_html(aging, inv) {
		const tones = { fresh: "#22c55e", aging: "#eab308", stale: "#f97316", critical: "#ef4444" };
		const max = Math.max(1, ...aging.map((a) => a.count));
		const rows = aging
			.map(
				(a) => `
				<button class="db-age-row" data-age="${a.key}">
					<span class="db-age-label">${this.esc(__(a.label))}</span>
					<span class="db-age-track"><span class="db-age-fill" style="width:${(a.count / max) * 100}%;background:${tones[a.key]}"></span></span>
					<span class="db-age-count">${a.count}</span>
				</button>`
			)
			.join("");
		return `
			<div class="db-card">
				<div class="db-card-head">
					<div>
						<div class="db-card-title">${__("Lot Aging")}</div>
						<div class="db-card-sub">${__("Days since each unit hit the lot")}</div>
					</div>
				</div>
				<div class="db-aging">${rows}</div>
				<div class="db-mini-stats">
					<div><div class="db-mini-value">${this.esc(this.money(inv.total_investment))}</div><div class="db-mini-label">${__("Invested")}</div></div>
					<div><div class="db-mini-value">${this.esc(this.money(inv.potential_profit))}</div><div class="db-mini-label">${__("Potential profit")}</div></div>
				</div>
			</div>`;
	}

	status_pill(status) {
		const s = dealer_management.VEHICLE_STATUS[status];
		return `<span class="indicator-pill ${s ? s.indicator : "gray"}">${this.esc(__(status))}</span>`;
	}

	recent_vehicles_html(vehicles) {
		const rows = vehicles
			.map((v) => {
				const title = [v.year, v.make, v.model].filter(Boolean).join(" ") || v.name;
				const sub = [v.trim, v.stock_number ? `#${v.stock_number}` : null]
					.filter(Boolean)
					.join(" · ");
				return `
				<tr class="db-clickable" data-route='${this.esc(JSON.stringify(["Form", "Vehicle Inventory", v.name]))}'>
					<td>
						<div class="db-veh">
							<span class="db-veh-avatar">${this.icon("car-front")}</span>
							<div>
								<div class="db-veh-title">${this.esc(title)}</div>
								<div class="db-veh-sub">${this.esc(sub || v.name)}</div>
							</div>
						</div>
					</td>
					<td>${this.status_pill(v.status)}</td>
					<td class="db-num">${v.asking_price ? this.esc(dealer_management.full_currency(v.asking_price)) : "—"}</td>
					<td class="db-num db-muted">${__("{0}d", [v.age == null ? 0 : v.age])}</td>
				</tr>`;
			})
			.join("");
		return `
			<div class="db-card db-card-flush">
				<div class="db-card-head">
					<div>
						<div class="db-card-title">${__("Recently Added")}</div>
						<div class="db-card-sub">${__("Newest units in inventory")}</div>
					</div>
					<a class="db-link" data-route='${this.esc(JSON.stringify(["List", "Vehicle Inventory"]))}'>${__("View all")} →</a>
				</div>
				${
					vehicles.length
						? `<div class="db-table-wrap"><table class="db-table">
							<thead><tr><th>${__("Vehicle")}</th><th>${__("Status")}</th><th class="db-num">${__("Asking")}</th><th class="db-num">${__("Age")}</th></tr></thead>
							<tbody>${rows}</tbody>
						</table></div>`
						: `<div class="db-empty">${__("No vehicles yet. Add one to get started.")}</div>`
				}
			</div>`;
	}

	follow_ups_html(leads) {
		const items = (leads.follow_ups || [])
			.map((l) => {
				const name = [l.first_name, l.last_name].filter(Boolean).join(" ") || l.name;
				const overdue = l.next_follow_up < frappe.datetime.get_today();
				return `
				<li class="db-clickable" data-route='${this.esc(JSON.stringify(["Form", "Dealer Lead", l.name]))}'>
					<span class="db-avatar">${this.esc(frappe.get_abbr(name))}</span>
					<div class="db-li-body">
						<div class="db-li-title">${this.esc(name)}</div>
						<div class="db-li-sub">${this.esc(__(l.status))}${l.phone ? " · " + this.esc(l.phone) : ""}</div>
					</div>
					<span class="db-badge ${overdue ? "db-badge-red" : "db-badge-amber"}">${overdue ? __("Overdue") : __("Today")}</span>
				</li>`;
			})
			.join("");
		return `
			<div class="db-card">
				<div class="db-card-head">
					<div>
						<div class="db-card-title">${__("Follow-ups Due")}</div>
						<div class="db-card-sub">${__("{0} open leads · {1} new", [leads.open, leads.new])}</div>
					</div>
					<a class="db-link" data-route='${this.esc(JSON.stringify(["List", "Dealer Lead"]))}'>${__("Leads")} →</a>
				</div>
				${items ? `<ul class="db-list">${items}</ul>` : `<div class="db-empty db-empty-sm">${__("You're all caught up. 🎉")}</div>`}
			</div>`;
	}

	// ---------- interactions ----------

	bind_events() {
		const open_filter = ["not in", ["Sold", "Wholesale"]];

		this.$root.find("[data-route]").on("click", (e) => {
			e.preventDefault();
			frappe.set_route(...JSON.parse(e.currentTarget.dataset.route));
		});

		this.$root.find(".db-tile").on("keydown", (e) => {
			if (e.key === "Enter" && e.target === e.currentTarget) e.currentTarget.click();
		});
		this.$root.find(".db-tile-new").on("click", (e) => {
			e.stopPropagation();
			frappe.new_doc(e.currentTarget.dataset.new);
		});

		this.$root
			.find(".db-search-input")
			.on("input", (e) => {
				this.search_query = e.target.value;
				this.filter_nav(this.search_query);
			})
			.on("keydown", (e) => {
				// Enter opens the first match.
				if (e.key !== "Enter") return;
				const first = this.$root.find(".db-tile:not([hidden]), .db-setup-link:not([hidden])").get(0);
				if (first) first.click();
			});

		this.$root.find(".db-stage").on("click", (e) => {
			frappe.set_route("List", "Vehicle Inventory", { status: e.currentTarget.dataset.status });
		});

		this.$root.find(".db-age-row").on("click", (e) => {
			const today = frappe.datetime.get_today();
			const ago = (days) => frappe.datetime.add_days(today, -days);
			const ranges = {
				fresh: [">=", ago(30)],
				aging: ["between", [ago(60), ago(31)]],
				stale: ["between", [ago(90), ago(61)]],
				critical: ["<", ago(90)],
			};
			frappe.set_route("List", "Vehicle Inventory", {
				status: open_filter,
				lot_date: ranges[e.currentTarget.dataset.age],
			});
		});

		const actions = {
			"add-vehicle": () => frappe.new_doc("Vehicle Inventory"),
			import: () => dealer_management.document_import.open(),
			"ai-settings": () => frappe.set_route("Form", "AI Settings"),
		};
		this.$root.find("[data-action]").on("click", (e) => {
			const fn = actions[e.currentTarget.dataset.action];
			if (fn) fn();
		});
	}
}
