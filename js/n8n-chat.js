// Chat widget EduFunnel -> n8n (Chat Trigger + AI Agent)
// Isi N8N_CHAT_URL dengan "Production URL" dari node "When chat message received".
import { createChat } from "https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js";

const N8N_CHAT_URL = "https://crimp-shawl-thesis.ngrok-free.dev/webhook/e5bd7fec-3a4a-4c53-ae2c-bc41ad89f926/chat";

let chatStarted = false;

window.initN8nChat = function () {
  if (chatStarted) return;

  if (N8N_CHAT_URL.startsWith("PASTE_")) {
    console.warn("EduFunnel chat: N8N_CHAT_URL belum diisi di js/n8n-chat.js");
    return;
  }

  chatStarted = true;

  createChat({
    webhookUrl: N8N_CHAT_URL,
    webhookConfig: {
      method: "POST",
      headers: {
        // Melewati halaman peringatan ngrok (free) agar fetch dari browser tidak diblokir.
        "ngrok-skip-browser-warning": "true"
      }
    },
    mode: "window",
    showWelcomeScreen: false,
    loadPreviousSession: false,
    initialMessages: [
      "Halo! Aku asisten EduFunnel.",
      "Tanya apa saja soal data funnel penerimaan mahasiswa."
    ],
    i18n: {
      en: {
        title: "EduFunnel Assistant",
        subtitle: "Terhubung ke n8n",
        footer: "",
        getStarted: "Mulai chat",
        inputPlaceholder: "Tulis pertanyaanmu..."
      }
    }
  });
};
