// Chat box / asisten AI EduFunnel -> n8n (Chat Trigger + AI Agent)
// Hanya lapisan tampilan: widget ini cuma mengirim pesan ke webhook n8n.
// Tidak ada query/perubahan ke database Supabase dari file ini.
//
// Isi N8N_CHAT_URL dengan "Production URL" dari node "Saat pesan obrolan diterima"
// (When chat message received). Workflow n8n harus Active/Published.
import { createChat } from "https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js";

const N8N_CHAT_URL = "https://crimp-shawl-thesis.ngrok-free.dev/webhook/e5bd7fec-3a4a-4c53-ae2c-bc41ad89f926/chat";

let chatStarted = false;

function startChat() {
  if (chatStarted) return;

  if (!N8N_CHAT_URL || N8N_CHAT_URL.startsWith("PASTE_")) {
    console.warn("EduFunnel chat: N8N_CHAT_URL belum diisi di js/n8n-chat.js");
    return;
  }

  chatStarted = true;

  createChat({
    webhookUrl: N8N_CHAT_URL,
    webhookConfig: {
      method: "POST",
      headers: {
        // Melewati halaman peringatan ngrok (akun gratis) agar fetch dari browser tidak diblokir.
        "ngrok-skip-browser-warning": "true"
      }
    },
    mode: "window",
    showWelcomeScreen: false,
    loadPreviousSession: true,
    chatInputKey: "chatInput",
    chatSessionKey: "sessionId",
    initialMessages: [
      "Halo! Aku asisten AI EduFunnel 👋",
      "Tanya apa saja soal data funnel penerimaan mahasiswa, misalnya: \"Channel mana yang paling banyak pengunjung?\" atau \"Di tahap mana drop-off terbesar?\""
    ],
    i18n: {
      en: {
        title: "EduFunnel Assistant",
        subtitle: "Asisten AI terhubung ke n8n",
        footer: "",
        getStarted: "Mulai chat",
        inputPlaceholder: "Tulis pertanyaanmu..."
      }
    }
  });
}

// Dipanggil oleh main.js setelah login berhasil (showDashboardPage).
window.initN8nChat = startChat;

// Jika main.js sudah menampilkan dashboard sebelum modul ini selesai dimuat
// (modul dieksekusi belakangan), langsung mulai.
if (document.body.classList.contains("dashboard-active")) {
  startChat();
}
