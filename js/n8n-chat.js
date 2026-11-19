// Koneksi AI Assistant EduFunnel -> n8n (Chat Trigger + AI Agent)
// URL webhook tetap sama seperti sebelumnya; hanya tampilannya yang kini berupa halaman AI Assistant.
const N8N_CHAT_URL = "https://crimp-shawl-thesis.ngrok-free.dev/webhook/e5bd7fec-3a4a-4c53-ae2c-bc41ad89f926/chat";

const chatSessionId = (window.crypto && crypto.randomUUID)
  ? crypto.randomUUID()
  : String(Date.now()) + Math.random().toString(16).slice(2);

function extractReply(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";

  // Respons biasa: {"output": "..."}
  try {
    const parsed = JSON.parse(text);
    const item = Array.isArray(parsed) ? parsed[0] : parsed;
    const reply = item && (item.output || item.text || item.message);
    if (reply) return String(reply);
  } catch (error) {
    // bukan satu objek JSON, lanjut cek format streaming
  }

  // Respons streaming: satu objek JSON per baris ({"type":"item","content":"..."})
  let streamed = "";
  text.split("\n").forEach(function (line) {
    try {
      const chunk = JSON.parse(line);
      if (chunk.type === "item" && typeof chunk.content === "string") {
        streamed += chunk.content;
      }
    } catch (error) {
      // abaikan baris yang bukan JSON
    }
  });

  return streamed || text;
}

window.EduFunnelChat = {
  async send(message) {
    const response = await fetch(N8N_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Melewati halaman peringatan ngrok (free) agar fetch dari browser tidak diblokir.
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify({
        action: "sendMessage",
        sessionId: chatSessionId,
        chatInput: message
      })
    });

    if (!response.ok) {
      throw new Error("n8n membalas dengan status " + response.status);
    }

    const reply = extractReply(await response.text());

    if (!reply) {
      throw new Error("Balasan dari n8n kosong");
    }

    return reply;
  }
};
