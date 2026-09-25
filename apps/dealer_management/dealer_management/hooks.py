app_name = "dealer_management"
app_title = "Dealer Management"
app_publisher = "Your Company"
app_description = "Vehicle inventory and sales management for independent auto dealers"
app_logo_url = "/assets/dealer_management/images/dealerbase-logo.svg"
app_home = "/desk/dealer-home"
app_email = "info@yourcompany.com"
app_license = "MIT"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
add_to_apps_screen = [
    {
        "name": "dealer_management",
        "logo": "/assets/dealer_management/images/dealerbase-logo.svg",
        "title": "Dealerbase",
        "route": "/desk/dealer-home",
    }
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = ["/assets/dealer_management/css/dealerbase_theme.css"]
app_include_js = [
    "/assets/dealer_management/js/dealerbase.js",
    "/assets/dealer_management/js/document_import.js",
]

# include js, css files in header of web template
web_include_css = ["/assets/dealer_management/css/dealerbase_web.css"]
web_include_js = ["/assets/dealer_management/js/dealerbase_web.js"]

# include custom scss in every website theme (without signing in)
# website_theme_scss = "dealer_management/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Iconse
# ------------------
# include app icons in desk
# app_include_icons = "dealer_management/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "dealer_management.utils.jinja_methods",
# 	"filters": "dealer_management.utils.jinja_filters"
# }

# Installation
# ------------

after_install = "dealer_management.install.after_install"
after_migrate = "dealer_management.install.after_migrate"

# The setup wizard resets the desk home page when it finishes; point it back at
# the Dealerbase dashboard.
setup_wizard_success = "dealer_management.install.after_setup_wizard"

# Uninstallation
# ------------

# before_uninstall = "dealer_management.uninstall.before_uninstall"
# after_uninstall = "dealer_management.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "dealer_management.utils.before_app_install"
# after_app_install = "dealer_management.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "dealer_management.utils.before_app_uninstall"
# after_app_uninstall = "dealer_management.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "dealer_management.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"dealer_management.tasks.all"
# 	],
# 	"daily": [
# 		"dealer_management.tasks.daily"
# 	],
# 	"hourly": [
# 		"dealer_management.tasks.hourly"
# 	],
# 	"weekly": [
# 		"dealer_management.tasks.weekly"
# 	],
# 	"monthly": [
# 		"dealer_management.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "dealer_management.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "dealer_management.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "dealer_management.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["dealer_management.utils.before_request"]
# after_request = ["dealer_management.utils.after_request"]

# Job Events
# ----------
# before_job = ["dealer_management.utils.before_job"]
# after_job = ["dealer_management.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"dealer_management.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# Fixtures
# --------
# Load default data when the app is installed

fixtures = [
    "Expense Category",
    "Listing Platform",
    "Lienholder",
    "Acquisition Source",
    "Number Card",
    "Dashboard Chart",
]

# Auto-naming Series
# ------------------
# Define custom naming series for DocTypes

autoname_series = {
    "Vehicle Inventory": "VH-.YYYY.-.#####",
    "Company Expense": "EXP-.YYYY.-.MM.-.#####"
}
