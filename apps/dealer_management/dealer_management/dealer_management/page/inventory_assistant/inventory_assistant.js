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
      <div class="chat-messages" id="chat-messages">
        <div class="ia-welcome">
          <div class="ia-welcome-icon">${frappe.utils.icon("sparkles", "lg")}</div>
          <h2 class="ia-welcome-title">${__("How can I help today?")}</h2>
          <p class="ia-welcome-sub">${__("Ask about your inventory and sales, or make updates in plain English.")}</p>
          <div class="example-prompts">
            ${suggestion("Show me all vehicles awaiting title", __("Awaiting title"), __("List units still waiting on paperwork"))}
            ${suggestion("What's our inventory summary?", __("Inventory summary"), __("Counts, value and potential profit"))}
            ${suggestion("How many vehicles did we sell this month?", __("Sales this month"), __("Units sold and revenue so far"))}
            ${suggestion("Which vehicles have been on the lot more than 60 days?", __("Aged units"), __("Find inventory that needs attention"))}
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
      }
    } catch (error) {
      thinkingDiv.remove();
      addMessage("Sorry, something went wrong. Please try again.", "assistant");
      console.error(error);
    }

    setLoading(false);
    input.focus();
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
};
