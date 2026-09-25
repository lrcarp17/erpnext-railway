frappe.listview_settings["Dealer Vehicle"] = {
    onload: function (listview) {
        listview.page.add_inner_button(__("Import from Document"), function () {
            dealer_management.document_import.open();
        });
    },
};
