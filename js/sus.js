/* ================= SUS (System Usability Scale) =================
   Halaman kuesioner SUS: isi kuesioner, hitung skor, lihat hasil.
   Dipanggil dari renderPage("sus") di main.js.
   Tabel Supabase: sus_questions, sus_responses (lihat supabase_sus.sql). */

const SUS_TARGET = 70;

// Opsional: isi dengan URL webhook n8n (mis. http://localhost:5678/webhook/kuesioner-sus)
// agar tiap jawaban juga dikirim ke jalur A pipeline. Kosongkan kalau tidak dipakai.
const SUS_WEBHOOK_URL = "";

const SUS_DEFAULT_QUESTIONS = [
  "Saya pikir saya akan sering menggunakan sistem ini.",
  "Saya merasa sistem ini terlalu rumit padahal tidak perlu.",
  "Saya pikir sistem ini mudah digunakan.",
  "Saya pikir saya membutuhkan bantuan orang teknis untuk bisa menggunakan sistem ini.",
  "Saya merasa fungsi-fungsi di sistem ini terpadu dengan baik.",
  "Saya pikir ada terlalu banyak ketidakkonsistenan di sistem ini.",
  "Saya membayangkan kebanyakan orang akan cepat belajar menggunakan sistem ini.",
  "Saya merasa sistem ini sangat membingungkan untuk digunakan.",
  "Saya merasa sangat percaya diri saat menggunakan sistem ini.",
  "Saya perlu belajar banyak hal dulu sebelum bisa menggunakan sistem ini dengan baik."
];

const SUS_SCALE_LABELS = ["Sangat tidak setuju", "Tidak setuju", "Netral", "Setuju", "Sangat setuju"];

const susState = {
  tab: "form",
  questions: null,
  responses: null,
  loadError: "",
  lastResult: null,
  sending: false,
  chart: null
};

/* ---------- Perhitungan ---------- */

// Butir ganjil: jawaban - 1. Butir genap: 5 - jawaban. Jumlah (0-40) x 2,5.
function susItemContribution(index, value) {
  return index % 2 === 0 ? value - 1 : 5 - value;
}

function calculateSUS(answers) {
  if (!Array.isArray(answers) || answers.length !== 10) return null;

  let total = 0;

  for (let i = 0; i < 10; i++) {
    const value = Number(answers[i]);

    if (!(value >= 1 && value <= 5)) return null;

    total += susItemContribution(i, value);
  }

  return total * 2.5;
}

// Skala nilai huruf dari Sauro & Lewis
function getSusGrade(score) {
  const table = [
    [84.1, "A+"], [80.8, "A"], [78.9, "A-"], [77.2, "B+"], [74.1, "B"], [72.6, "B-"],
    [71.1, "C+"], [65, "C"], [62.7, "C-"], [51.7, "D"], [0, "F"]
  ];

  return table.find(function (row) { return score >= row[0]; })[1];
}

// Kata sifat dari Bangor dkk.
function getSusAdjective(score) {
  if (score >= 85.58) return "Best Imaginable";
  if (score >= 72.75) return "Excellent";
  if (score >= 52.01) return "Good";
  if (score >= 39.17) return "OK";
  if (score >= 25) return "Poor";
  return "Worst Imaginable";
}

function formatSusScore(value) {
  return Number(value).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/* ---------- Data ---------- */

async function loadSusQuestions() {
  try {
    const { data, error } = await createSupabaseClient()
      .from("sus_questions")
      .select("nomor, teks")
      .order("nomor");

    if (!error && Array.isArray(data) && data.length === 10) {
      susState.questions = data.map(function (row) { return row.teks; });
      return;
    }
  } catch (error) {
    console.warn("Pertanyaan SUS memakai bawaan:", error);
  }

  susState.questions = SUS_DEFAULT_QUESTIONS.slice();
}

async function loadSusResponses() {
  susState.loadError = "";

  try {
    const { data, error } = await createSupabaseClient()
      .from("sus_responses")
      .select("id, created_at, nama, peran, sumber_trafik, jawaban, skor")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    susState.responses = (data || []).map(function (row) {
      return { ...row, skor: Number(row.skor) };
    });
  } catch (error) {
    susState.responses = [];
    susState.loadError = "Hasil SUS belum bisa dimuat. Pastikan supabase_sus.sql sudah dijalankan. (" + (error.message || error) + ")";
  }
}

/* ---------- Render ---------- */

async function renderSUS() {
  app.innerHTML = `
    <section class="page-title">
      <p>USABILITY TEST</p>
      <h1>Kuesioner SUS</h1>
      <span>System Usability Scale: 10 pertanyaan, skala 1-5, skor akhir 0-100.</span>
    </section>
    <section id="susBody"><div class="card"><p>Memuat...</p></div></section>
  `;

  await Promise.all([
    susState.questions ? Promise.resolve() : loadSusQuestions(),
    loadSusResponses()
  ]);

  if (currentPage !== "sus") return;

  renderSusBody();
}

function renderSusBody() {
  const body = document.getElementById("susBody");

  if (!body) return;

  if (susState.chart) {
    susState.chart.destroy();
    susState.chart = null;
  }

  body.innerHTML = `
    <div class="sus-tabs">
      <button type="button" class="sus-tab ${susState.tab === "form" ? "active" : ""}" data-sus-tab="form">Isi Kuesioner</button>
      <button type="button" class="sus-tab ${susState.tab === "result" ? "active" : ""}" data-sus-tab="result">Hasil SUS (${susState.responses.length})</button>
    </div>
    <div id="susPanel"></div>
  `;

  body.querySelectorAll("[data-sus-tab]").forEach(function (button) {
    button.onclick = function () {
      susState.tab = button.dataset.susTab;
      renderSusBody();
    };
  });

  if (susState.tab === "form") {
    renderSusForm();
  } else {
    renderSusResults();
  }
}

function renderSusForm() {
  const panel = document.getElementById("susPanel");

  const questionsMarkup = susState.questions.map(function (text, index) {
    const options = [1, 2, 3, 4, 5].map(function (value) {
      return `
        <label class="sus-option">
          <input type="radio" name="sus_q${index}" value="${value}" required />
          <span>${value}</span>
        </label>
      `;
    }).join("");

    return `
      <div class="sus-question">
        <p class="sus-question-text"><b>${index + 1}.</b> ${escapeHtml(text)}</p>
        <div class="sus-scale">
          <small>${SUS_SCALE_LABELS[0]}</small>
          <div class="sus-options">${options}</div>
          <small>${SUS_SCALE_LABELS[4]}</small>
        </div>
      </div>
    `;
  }).join("");

  const resultMarkup = susState.lastResult ? `
    <div class="card sus-result-banner">
      <h3 class="label">Skor SUS kamu</h3>
      <p class="sus-big">${formatSusScore(susState.lastResult)}</p>
      <span>Nilai ${getSusGrade(susState.lastResult)} (${getSusAdjective(susState.lastResult)}). Terima kasih sudah mengisi.</span>
    </div>
  ` : "";

  panel.innerHTML = `
    ${resultMarkup}
    <form id="susForm" class="card sus-form" autocomplete="off">
      <div class="sus-meta">
        <div>
          <label for="susNama">Nama</label>
          <input id="susNama" type="text" placeholder="Nama responden" required />
        </div>
        <div>
          <label for="susPeran">Peran</label>
          <input id="susPeran" type="text" list="susPeranList" placeholder="Marketing, Pimpinan, ..." />
          <datalist id="susPeranList">
            <option value="Marketing"></option>
            <option value="Pimpinan"></option>
            <option value="Admin Akademik"></option>
            <option value="Lainnya"></option>
          </datalist>
        </div>
        <div>
          <label for="susSumber">Sumber trafik</label>
          <select id="susSumber">
            <option value="">Tidak ada</option>
            <option value="Google Ads">Google Ads</option>
            <option value="Instagram">Instagram</option>
            <option value="Twitter/X">Twitter/X</option>
            <option value="Website">Website</option>
          </select>
        </div>
      </div>

      <p class="sus-hint">Pilih angka 1 (sangat tidak setuju) sampai 5 (sangat setuju) sesuai pengalamanmu memakai dashboard ini.</p>

      ${questionsMarkup}

      <p id="susFormMessage" class="sus-message" aria-live="polite"></p>
      <button id="susSubmit" type="submit" class="auth-button">Kirim jawaban</button>
    </form>
  `;

  document.getElementById("susForm").onsubmit = submitSusForm;
}

async function submitSusForm(event) {
  event.preventDefault();

  if (susState.sending) return;

  const message = document.getElementById("susFormMessage");
  const submit = document.getElementById("susSubmit");
  const answers = [];

  for (let i = 0; i < 10; i++) {
    const checked = document.querySelector(`input[name="sus_q${i}"]:checked`);

    if (!checked) {
      message.textContent = "Pertanyaan nomor " + (i + 1) + " belum dijawab.";
      message.className = "sus-message error";
      return;
    }

    answers.push(Number(checked.value));
  }

  const score = calculateSUS(answers);
  const payload = {
    nama: document.getElementById("susNama").value.trim(),
    peran: document.getElementById("susPeran").value.trim() || null,
    sumber_trafik: document.getElementById("susSumber").value || null,
    jawaban: answers,
    skor: score
  };

  susState.sending = true;
  submit.disabled = true;
  submit.textContent = "Mengirim...";

  try {
    const { error } = await createSupabaseClient().from("sus_responses").insert(payload);

    if (error) throw error;

    sendSusToWebhook(payload);

    susState.lastResult = score;
    susState.tab = "form";
    await loadSusResponses();

    if (currentPage === "sus") renderSusBody();
  } catch (error) {
    message.textContent = "Gagal menyimpan: " + (error.message || error);
    message.className = "sus-message error";
    submit.disabled = false;
    submit.textContent = "Kirim jawaban";
  } finally {
    susState.sending = false;
  }
}

function sendSusToWebhook(payload) {
  if (!SUS_WEBHOOK_URL) return;

  fetch(SUS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nama: payload.nama,
      peran: payload.peran,
      sumber_trafik: payload.sumber_trafik,
      jawaban: payload.jawaban
    })
  }).catch(function (error) {
    console.warn("Webhook SUS gagal:", error);
  });
}

function renderSusResults() {
  const panel = document.getElementById("susPanel");
  const rows = susState.responses;

  if (susState.loadError) {
    panel.innerHTML = `<div class="card"><p class="sus-message error">${escapeHtml(susState.loadError)}</p></div>`;
    return;
  }

  if (rows.length === 0) {
    panel.innerHTML = `
      <div class="card">
        <h2>Belum ada jawaban</h2>
        <p>Hasil akan muncul di sini setelah ada yang mengisi kuesioner.</p>
      </div>
    `;
    return;
  }

  const average = rows.reduce(function (sum, row) { return sum + row.skor; }, 0) / rows.length;
  const reached = average >= SUS_TARGET;

  const itemAverages = susState.questions.map(function (_, index) {
    const total = rows.reduce(function (sum, row) {
      return sum + susItemContribution(index, Number(row.jawaban[index]));
    }, 0);

    return total / rows.length;
  });

  const tableRows = rows.map(function (row) {
    const date = new Date(row.created_at).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    return `
      <tr>
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(row.nama)}</td>
        <td>${escapeHtml(row.peran || "-")}</td>
        <td>${escapeHtml(row.sumber_trafik || "-")}</td>
        <td><b>${formatSusScore(row.skor)}</b></td>
        <td>${getSusGrade(row.skor)} - ${getSusAdjective(row.skor)}</td>
      </tr>
    `;
  }).join("");

  panel.innerHTML = `
    <div class="sus-summary">
      <div class="summary-card"><h3>Responden</h3><p>${rows.length}</p></div>
      <div class="summary-card"><h3>Rata-rata skor SUS</h3><p>${formatSusScore(average)}</p></div>
      <div class="summary-card"><h3>Nilai</h3><p>${getSusGrade(average)}</p><small>${getSusAdjective(average)}</small></div>
      <div class="summary-card">
        <h3>Target &ge; ${SUS_TARGET}</h3>
        <p class="${reached ? "sus-ok" : "sus-bad"}">${reached ? "Tercapai" : "Belum"}</p>
        <small>Rata-rata lintas studi sekitar 68</small>
      </div>
    </div>

    <div class="card sus-chart-card">
      <h2>Rata-rata kontribusi per pertanyaan</h2>
      <p>Skala 0-4 setelah dikonversi. Batang yang pendek menunjukkan butir yang perlu diperbaiki.</p>
      <div class="sus-chart-wrap"><canvas id="susItemChart"></canvas></div>
    </div>

    <div class="card">
      <div class="sus-table-head">
        <h2>Jawaban responden</h2>
        <button type="button" id="susExport" class="assistant-chip">Unduh CSV</button>
      </div>
      <div class="sus-table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Waktu</th><th>Nama</th><th>Peran</th><th>Sumber</th><th>Skor</th><th>Nilai</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("susExport").onclick = exportSusCSV;
  drawSusItemChart(itemAverages);
}

function drawSusItemChart(itemAverages) {
  const canvas = document.getElementById("susItemChart");

  if (!canvas || !window.Chart) return;

  susState.chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: itemAverages.map(function (_, index) { return "P" + (index + 1); }),
      datasets: [{
        label: "Rata-rata kontribusi (0-4)",
        data: itemAverages.map(function (value) { return Number(value.toFixed(2)); }),
        backgroundColor: itemAverages.map(function (value) {
          return value >= 3 ? "rgba(64,242,165,0.75)" : value >= 2 ? "rgba(79,140,255,0.75)" : "rgba(255,107,107,0.75)";
        }),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 4, ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.06)" } },
        x: { ticks: { color: "#94a3b8" }, grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function (items) {
              return susState.questions[items[0].dataIndex];
            }
          }
        }
      }
    }
  });
}

function exportSusCSV() {
  const header = ["waktu", "nama", "peran", "sumber_trafik"]
    .concat(susState.questions.map(function (_, i) { return "P" + (i + 1); }))
    .concat(["skor_sus"]);

  const lines = [header.join(",")].concat(susState.responses.map(function (row) {
    return [row.created_at, row.nama, row.peran || "", row.sumber_trafik || ""]
      .concat(row.jawaban)
      .concat([row.skor])
      .map(escapeCSVValue)
      .join(",");
  }));

  downloadBlob(lines.join("\n"), "hasil-sus-edufunnel.csv", "text/csv;charset=utf-8");
}
