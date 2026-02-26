import { useState, useRef, useEffect } from "react";
import type { LogEntry } from "./ToolPanel";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { moduleId: string; inputs: Record<string, unknown>; result: Record<string, unknown> }[];
}

interface ChatPanelProps {
  getEditorHtml: () => string;
  role: "readonly" | "editor" | "admin";
  onEditorUpdate: (html: string) => void;
  onLog: (entry: LogEntry) => void;
}

export default function ChatPanel({
  getEditorHtml,
  role,
  onEditorUpdate,
  onLog,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        if (data.defaultModel) setModel(data.defaultModel);
      })
      .catch(() => setModel("openai:gpt-4o"));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          editorHtml: getEditorHtml(),
          model,
          role,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Log tool calls
      if (data.toolCalls && data.toolCalls.length > 0) {
        for (const tc of data.toolCalls) {
          onLog({
            type: "success",
            message: `AI: ${tc.moduleId}(${JSON.stringify(tc.inputs)}) -> ${JSON.stringify(tc.result)}`,
            timestamp: Date.now(),
          });
        }
      }

      // Update editor with new HTML
      if (data.updatedHtml) {
        onEditorUpdate(data.updatedHtml);
      }

      // Add assistant response
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.reply,
        toolCalls: data.toolCalls,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog({
        type: "error",
        message: `Chat error: ${msg}`,
        timestamp: Date.now(),
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="card chat-panel">
      <h2>AI Chat</h2>

      <div className="chat-model-selector">
        <label htmlFor="model-input">Model:</label>
        <input
          id="model-input"
          type="text"
          className="model-input"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="provider:model"
        />
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            Ask AI to edit your document. It will use TipTap tools with ACL role: <strong>{role}</strong>.
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            <div className="chat-message-label">
              {msg.role === "user" ? "You" : "AI"}
            </div>
            <div className="chat-message-content">{msg.content}</div>
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <details className="chat-tool-calls">
                <summary>{msg.toolCalls.length} tool call{msg.toolCalls.length > 1 ? "s" : ""}</summary>
                <div className="tool-call-list">
                  {msg.toolCalls.map((tc, j) => (
                    <div key={j} className="tool-call-item">
                      <span className="tool-call-name">{tc.moduleId}</span>
                      <span className="tool-call-args">{JSON.stringify(tc.inputs)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}

        {loading && (
          <div className="chat-message assistant">
            <div className="chat-message-label">AI</div>
            <div className="chat-message-content chat-loading">
              <span className="dot-pulse"></span>
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI to edit the document..."
          rows={2}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
