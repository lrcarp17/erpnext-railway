frappe.listview_settings["Dealer Lead"] = {
	add_fields: ["status", "next_follow_up"],

	get_indicator: function (doc) {
		const color = (dealer_management.LEAD_STATUS || {})[doc.status] || "gray";
		return [__(doc.status), color, "status,=," + doc.status];
	},
};
