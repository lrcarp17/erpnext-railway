frappe.pages["inventory-assistant"].on_page_load = function (wrapper) {
  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: "Inventory Assistant",
    single_column: true,
  });

  page.main.html(`
    <div class="inventory-assistant-container">
      <div class="assistant-header">
        <p class="text-muted">Ask me about your inventory, sales, or make updates using natural language.</p>
        <div class="example-prompts">
          <span class="example-prompt" data-prompt="Show me all vehicles awaiting title">Awaiting title</span>
          <span class="example-prompt" data-prompt="What's our inventory summary?">Inventory summary</span>
          <span class="example-prompt" data-prompt="How many vehicles did we sell this month?">Sales this month</span>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-container">
        <textarea 
          id="chat-input" 
          placeholder="Ask about inventory, update vehicles, get statistics..."
          rows="1"
        ></textarea>
        <button class="btn btn-primary btn-send" id="send-btn">
          <svg class="icon icon-sm"><use href="#icon-send"></use></svg>
        </button>
      </div>
    </div>
    <style>
      .inventory-assistant-container {
        max-width: 800px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        height: calc(100vh - 200px);
        min-height: 400px;
      }
      .assistant-header {
        padding: 1rem 0;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 1rem;
      }
      .example-prompts {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-top: 0.5rem;
      }
      .example-prompt {
        background: var(--bg-light-gray);
        padding: 0.25rem 0.75rem;
        border-radius: 1rem;
        font-size: 0.85rem;
        cursor: pointer;
        transition: background 0.2s;
      }
      .example-prompt:hover {
        background: var(--bg-dark-gray);
      }
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem 0;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .chat-message {
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        max-width: 85%;
        line-height: 1.5;
      }
      .chat-message.user {
        background: var(--primary);
        color: white;
        align-self: flex-end;
        margin-left: auto;
      }
      .chat-message.assistant {
        background: var(--bg-light-gray);
        align-self: flex-start;
      }
      .chat-message.assistant pre {
        background: var(--bg-dark-gray);
        padding: 0.5rem;
        border-radius: 0.25rem;
        overflow-x: auto;
        margin: 0.5rem 0;
      }
      .chat-message.assistant code {
        font-size: 0.85em;
      }
      .chat-message.thinking {
        background: var(--bg-light-gray);
        color: var(--text-muted);
        font-style: italic;
      }
      .chat-input-container {
        display: flex;
        gap: 0.5rem;
        padding: 1rem 0;
        border-top: 1px solid var(--border-color);
        align-items: flex-end;
      }
      #chat-input {
        flex: 1;
        border: 1px solid var(--border-color);
        border-radius: 0.5rem;
        padding: 0.75rem;
        resize: none;
        font-family: inherit;
        font-size: inherit;
        max-height: 150px;
      }
      #chat-input:focus {
        outline: none;
        border-color: var(--primary);
      }
      .btn-send {
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
      }
      .btn-send:disabled {
        opacity: 0.5;
      }
    </style>
  `);

  let conversation = [];
  const messagesContainer = document.getElementById("chat-messages");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");

  function addMessage(content, role) {
    const div = document.createElement("div");
    div.className = `chat-message ${role}`;
    if (role === "assistant") {
      div.innerHTML = frappe.markdown(content);
    } else {
      div.textContent = content;
    }
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return div;
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

  document.querySelectorAll(".example-prompt").forEach((el) => {
    el.addEventListener("click", () => {
      input.value = el.dataset.prompt;
      input.focus();
    });
  });

  addMessage(
    "Hi! I'm your inventory assistant. I can help you search vehicles, check statistics, and make updates. What would you like to know?",
    "assistant"
  );
};
