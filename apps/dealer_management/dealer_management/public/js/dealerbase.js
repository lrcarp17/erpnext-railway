// Shared Dealerbase UI helpers: status colours and number formatting, used by the
// home dashboard and the list views so a status looks the same everywhere.
frappe.provide("dealer_management");

// hex drives charts and the pipeline bar; indicator is Frappe's pill colour.
dealer_management.VEHICLE_STATUS = {
	"Awaiting Pickup": { hex: "#f97316", indicator: "orange" },
	"Awaiting Title": { hex: "#eab308", indicator: "yellow" },
	"Pre-Sale": { hex: "#a855f7", indicator: "purple" },
	"In Recon": { hex: "#06b6d4", indicator: "cyan" },
	Frontline: { hex: "#3b82f6", indicator: "blue" },
	Available: { hex: "#22c55e", indicator: "green" },
	"Pending Sale": { hex: "#ec4899", indicator: "pink" },
	Problem: { hex: "#ef4444", indicator: "red" },
	Sold: { hex: "#64748b", indicator: "darkgrey" },
	Wholesale: { hex: "#94a3b8", indicator: "gray" },
};

dealer_management.LEAD_STATUS = {
	New: "blue",
	Contacted: "cyan",
	"Appointment Set": "purple",
	Showed: "orange",
	Negotiating: "yellow",
	Sold: "green",
	Lost: "gray",
};

dealer_management.currency_code = function () {
	return (frappe.boot && frappe.boot.sysdefaults && frappe.boot.sysdefaults.currency) || "USD";
};

// $1.2M / $48K style amounts for dashboards.
dealer_management.compact_currency = function (value) {
	value = flt(value);
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: dealer_management.currency_code(),
			notation: "compact",
			maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
		}).format(value);
	} catch (e) {
		return format_currency(value, dealer_management.currency_code(), 0);
	}
};

dealer_management.full_currency = function (value) {
	return format_currency(flt(value), dealer_management.currency_code(), 0);
};
