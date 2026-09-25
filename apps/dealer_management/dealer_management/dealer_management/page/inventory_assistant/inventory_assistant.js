frappe.pages["inventory-assistant"].on_page_load = function (wrapper) {
  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: "Inventory Assistant",
    single_column: true,
  });

  const suggestion = (prompt, title, body) => `
    <button class="ia-suggestion" data-prompt="${frappe.utils.escape_html(prompt)}">
      <span class="ia-suggestion-title">${title}</span>
      <span class="ia-suggestion-body">${body}</span>
    </button>`;

  page.main.html(`
    <div class="inventory-assistant-container">
      <div class="ia-budget" id="ia-budget" hidden></div>
      <div class="chat-messages" id="chat-messages">
        <div class="ia-welcome">
          <div class="ia-welcome-icon">${frappe.utils.icon("sparkles", "lg")}</div>
          <h2 class="ia-welcome-title">${__("How can I help today?")}</h2>
          <p class="ia-welcome-sub">${__("Ask about your inventory and sales, or make updates in plain English.")}</p>
          <div class="example-prompts">
            ${suggestion("Show me all vehicles awaiting title", __("Awaiting title"), __("List units still waiting on paperwork"))}
            ${suggestion("What's our inventory summary?", __("Inventory summary"), __("Counts, value and potential profit"))}
            ${suggestion("How many vehicles did we sell this month?", __("Sales this month"), __("Units sold and revenue so far"))}
            ${suggestion("How much of my token budget is left this month?", __("Token budget"), __("AI usage this month and what's left"))}
          </div>
        </div>
      </div>
      <div class="chat-input-container">
        <div class="ia-composer">
          <textarea
            id="chat-input"
            placeholder="${__("Ask about inventory, update vehicles, get statistics…")}"
            rows="1"
          ></textarea>
          <button class="btn btn-primary btn-send" id="send-btn" aria-label="${__("Send")}">
            ${frappe.utils.icon("send", "sm")}
          </button>
        </div>
        <div class="ia-hint">${__("Enter to send · Shift + Enter for a new line")}</div>
      </div>
    </div>
  `);

  let conversation = [];
  let chatTokens = 0;
  let budgetStatus = null;
  const budgetEl = document.getElementById("ia-budget");
  const messagesContainer = document.getElementById("chat-messages");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");

  function addMessage(content, role) {
    const welcome = messagesContainer.querySelector(".ia-welcome");
    if (welcome && role === "user") welcome.remove();

    const row = document.createElement("div");
    row.className = `chat-row ${role}`;
    if (role !== "user") {
      const avatar = document.createElement("div");
      avatar.className = "chat-avatar";
      avatar.innerHTML = frappe.utils.icon("sparkles", "sm");
      row.appendChild(avatar);
    }

    const div = document.createElement("div");
    div.className = `chat-message ${role}`;
    if (role === "assistant") {
      div.innerHTML = frappe.markdown(content);
    } else if (role === "thinking") {
      div.innerHTML = '<span class="ia-dots"><span></span><span></span><span></span></span>';
    } else {
      div.textContent = content;
    }
    row.appendChild(div);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return row;
  }

  function setLoading(loading) {
    sendBtn.disabled = loading;
    input.disabled = loading;
  }

  async function sendMessage() {
    const message = input.value.trim();
    if (!message) return;

    input.value = "";
    input.style.height = "auto";
    addMessage(message, "user");

    const thinkingDiv = addMessage("Thinking...", "thinking");
    setLoading(true);

    try {
      const response = await frappe.call({
        method: "dealer_management.inventory_assistant.chat",
        args: {
          message: message,
          conversation_history: JSON.stringify(conversation),
        },
      });

      thinkingDiv.remove();

      if (response.message) {
        addMessage(response.message.response, "assistant");
        conversation = response.message.conversation;
        chatTokens += (response.message.usage && response.message.usage.total_tokens) || 0;
      }
    } catch (error) {
      thinkingDiv.remove();
      addMessage("Sorry, something went wrong. Please try again.", "assistant");
      console.error(error);
    }

    setLoading(false);
    input.focus();
    loadBudget();
  }

  // ---------- Token budget ----------

  const compact = (n) =>
    new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
  const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
  const resetLabel = (d) => frappe.datetime.str_to_user(d);

  function loadBudget() {
    return frappe
      .call({ method: "dealer_management.ai_usage.get_budget_status" })
      .then((r) => {
        budgetStatus = r.message;
        renderBudget();
      })
      .catch(() => {});
  }

  function renderBudget() {
    const b = budgetStatus;
    if (!b) return;
    const pct = b.budget ? Math.min(b.percent, 100) : 0;
    const tone = !b.budget ? "" : b.percent >= 100 ? "ia-over" : b.percent >= 80 ? "ia-warn" : "";
    const summary = b.budget
      ? __("{0} of {1} used · {2} left · resets {3}", [
          compact(b.used),
          compact(b.budget),
          compact(b.remaining),
          resetLabel(b.resets_on),
        ])
      : __("{0} tokens used this month · no budget set", [compact(b.used)]);

    budgetEl.hidden = false;
    budgetEl.className = `ia-budget ${tone}`;
    budgetEl.innerHTML = `
      <div class="ia-budget-main">
        <div class="ia-budget-top">
          <span class="ia-budget-label">${__("Token budget")} · ${esc(b.month)}</span>
          <span class="ia-budget-summary">${esc(summary)}</span>
        </div>
        ${b.budget ? `<div class="ia-budget-track"><span style="width:${pct}%"></span></div>` : ""}
      </div>
      <div class="ia-budget-side">
        <span class="ia-chat-tokens" title="${__("Tokens used by this conversation")}">${__("This chat")}: ${compact(chatTokens)}</span>
        <button class="btn btn-xs btn-default ia-budget-details">${__("Details")}</button>
      </div>`;
    budgetEl.querySelector(".ia-budget-details").addEventListener("click", showBudgetDetails);
  }

  function showBudgetDetails() {
    const b = budgetStatus;
    if (!b) return;
    const t = b.totals || {};
    const stat = (label, value, sub) => `
      <div class="ia-stat"><div class="ia-stat-value">${esc(value)}</div>
      <div class="ia-stat-label">${esc(label)}</div>${sub ? `<div class="ia-stat-sub">${esc(sub)}</div>` : ""}</div>`;

    const features = (b.by_feature || [])
      .map(
        (f) => `<tr><td>${esc(__(f.feature))}</td><td class="text-right">${format_number(f.actions, null, 0)}</td>
        <td class="text-right">${compact(f.input_tokens + f.cache_read_tokens + f.cache_write_tokens)}</td>
        <td class="text-right">${compact(f.output_tokens)}</td><td class="text-right"><b>${compact(f.total_tokens)}</b></td></tr>`
      )
      .join("");

    const rl = b.rate_limits || {};
    const rlRow = (key, label) => {
      const r = rl[key];
      if (!r || r.limit == null) return "";
      const left = r.limit ? Math.round((r.remaining / r.limit) * 100) : 0;
      return `<div class="ia-rl"><div class="ia-rl-top"><span>${esc(label)}</span>
        <span>${__("{0} of {1} left", [compact(r.remaining), compact(r.limit)])}</span></div>
        <div class="ia-budget-track"><span style="width:${left}%"></span></div></div>`;
    };
    const rateLimits = ["input_tokens", "output_tokens", "requests"].some((k) => rl[k])
      ? rlRow("input_tokens", __("Input tokens per minute")) +
        rlRow("output_tokens", __("Output tokens per minute")) +
        rlRow("requests", __("Requests per minute")) +
        `<div class="ia-note">${__("From Anthropic's response headers on the last request ({0}).", [
          esc(frappe.datetime.prettyDate(rl.as_of)),
        ])}</div>`
      : `<div class="ia-note">${__("Shown after the next AI request.")}</div>`;

    const d = new frappe.ui.Dialog({
      title: __("AI Token Usage · {0}", [b.month]),
      size: "large",
      fields: [{ fieldtype: "HTML", fieldname: "body" }],
    });
    d.fields_dict.body.$wrapper.html(`
      <div class="ia-budget-dialog">
        <div class="ia-stats">
          ${stat(__("Used this month"), format_number(b.used, null, 0), b.budget ? __("{0}% of budget", [b.percent]) : null)}
          ${stat(__("Monthly budget"), b.budget ? format_number(b.budget, null, 0) : __("Not set"), b.enforced ? __("AI stops when used up") : b.budget ? __("Warning only") : null)}
          ${stat(__("Remaining"), b.budget ? format_number(b.remaining, null, 0) : "—", __("Resets {0}", [resetLabel(b.resets_on)]))}
          ${stat(__("This chat"), format_number(chatTokens, null, 0), null)}
        </div>
        <h5>${__("By feature")}</h5>
        ${
          features
            ? `<table class="table table-sm ia-table"><thead><tr><th>${__("Feature")}</th><th class="text-right">${__("Uses")}</th>
               <th class="text-right">${__("Input")}</th><th class="text-right">${__("Output")}</th><th class="text-right">${__("Total")}</th></tr></thead>
               <tbody>${features}</tbody></table>
               <div class="ia-note">${__("{0} API requests · {1} input, {2} output, {3} cache read, {4} cache write tokens.", [
                 format_number(t.requests, null, 0), compact(t.input_tokens), compact(t.output_tokens),
                 compact(t.cache_read_tokens), compact(t.cache_write_tokens),
               ])}</div>`
            : `<div class="ia-note">${__("No AI usage recorded yet this month.")}</div>`
        }
        <h5>${__("Anthropic rate limits")}</h5>
        ${rateLimits}
        <div class="ia-note ia-note-box">${__(
          "This budget is tracked by Dealerbase. Your Anthropic account's credit balance and spend limit are not available through the API; see them on the {0}.",
          [`<a href="https://platform.claude.com/settings/billing" target="_blank" rel="noopener">${__("Claude Console billing page")}</a>`]
        )}</div>
      </div>`);
    if (b.can_configure) {
      d.set_primary_action(__("Edit Budget"), () => frappe.set_route("Form", "AI Settings"));
      d.set_secondary_action_label(__("Usage Log"));
      d.set_secondary_action(() => frappe.set_route("List", "AI Usage Log"));
    }
    d.show();
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 150) + "px";
  });

  sendBtn.addEventListener("click", sendMessage);

  wrapper.querySelectorAll(".ia-suggestion").forEach((el) => {
    el.addEventListener("click", () => {
      input.value = el.dataset.prompt;
      sendMessage();
    });
  });

  loadBudget();
};
