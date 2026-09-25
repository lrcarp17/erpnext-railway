frappe.listview_settings["Dealer Vehicle"] = {
	add_fields: ["status", "year", "make", "model", "asking_price"],

	get_indicator: function (doc) {
		const status = (dealer_management.VEHICLE_STATUS || {})[doc.status];
		return [__(doc.status), status ? status.indicator : "gray", "status,=," + doc.status];
	},

	onload: function (listview) {
		listview.page.add_inner_button(__("Import from Document"), function () {
			dealer_management.document_import.open();
		});
	},
};
