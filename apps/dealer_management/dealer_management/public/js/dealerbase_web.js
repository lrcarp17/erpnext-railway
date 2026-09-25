// Adds the Dealerbase brand panel beside the sign-in card on wide screens.
(function () {
	const AUTH_PATHS = ["login", "update-password"];

	function addBrandPanel() {
		const body = document.body;
		if (!body || !AUTH_PATHS.includes(body.dataset.path)) return;
		if (document.querySelector(".db-auth-panel")) return;

		const logo = "/assets/dealer_management/images/dealerbase-logo.svg";
		const panel = document.createElement("aside");
		panel.className = "db-auth-panel";
		panel.setAttribute("aria-hidden", "true");
		panel.innerHTML = `
			<div class="db-auth-brand"><img src="${logo}" alt="">Dealerbase</div>
			<div class="db-auth-copy">
				<h2>Run your whole dealership from one place.</h2>
				<p>Inventory, titles, recon and deals, tracked from acquisition to sale with real-time profit on every unit.</p>
				<ul class="db-auth-features">
					<li>Live inventory pipeline and lot aging</li>
					<li>Deal tracking with profit on every sale</li>
					<li>AI document import and inventory assistant</li>
				</ul>
			</div>
			<div class="db-auth-foot">© ${new Date().getFullYear()} Dealerbase</div>
		`;
		body.prepend(panel);
		body.classList.add("db-auth-split");
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", addBrandPanel);
	} else {
		addBrandPanel();
	}
})();
