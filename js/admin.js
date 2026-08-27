/*
 * 管理者画面ロジック。
 * questions.json をベースに、編集分は localStorage(studyOS_admin_overrides) に重ねて保持する。
 * 「JSONを保存」で確定版をダウンロードし、data/questions.json を手動で置き換える運用。
 */

const ADMIN_STORAGE = "studyOS_admin_overrides_v1";
let baseQuestions = [];
let workingQuestions = [];

async function bootAdmin() {
  const res = await fetch("data/questions.json");
  baseQuestions = await res.json();
  const overrides = loadOverrides();
  workingQuestions = overrides || baseQuestions;
  renderTable();

  document.getElementById("addBtn").onclick = () => openModal(null);
  document.getElementById("cancelBtn").onclick = closeModal;
  document.getElementById("qForm").onsubmit = handleSave;
  document.getElementById("previewBtn").onclick = renderPreview;
  document.getElementById("exportJsonBtn").onclick = exportJson;
  document.getElementById("exportCsvBtn").onclick = exportCsv;
}

function loadOverrides() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function persistOverrides() {
  localStorage.setItem(ADMIN_STORAGE, JSON.stringify(workingQuestions));
}

function renderTable() {
  const body = document.getElementById("qTableBody");
  body.innerHTML = workingQuestions.map(q => `
    <tr>
      <td>${q.id}</td>
      <td>${escapeHtml(q.資格)}</td>
      <td>${escapeHtml(q.分野)}</td>
      <td>${escapeHtml(q.難易度)}</td>
      <td>${escapeHtml((q.問題 || "").slice(0, 24))}...</td>
      <td class="row-actions">
        <button title="編集" onclick="openModal('${q.id}')">✏️</button>
        <button title="削除" onclick="deleteQuestion('${q.id}')">🗑</button>
      </td>
    </tr>
  `).join("");
}

function openModal(id) {
  const isEdit = !!id;
  document.getElementById("modalTitle").textContent = isEdit ? "問題を編集" : "問題を追加";
  const q = isEdit ? workingQuestions.find(x => x.id === id) : {};

  document.getElementById("f_id").value = q.id || "";
  document.getElementById("f_cert").value = q.資格 || "消防設備士乙6類";
  document.getElementById("f_field").value = q.分野 || "";
  document.getElementById("f_diff").value = q.難易度 || "標準";
  document.getElementById("f_freq").value = q.頻出度 || 3;
  document.getElementById("f_q").value = q.問題 || "";
  document.getElementById("f_a").value = q.選択肢A || "";
  document.getElementById("f_b").value = q.選択肢B || "";
  document.getElementById("f_c").value = q.選択肢C || "";
  document.getElementById("f_d").value = q.選択肢D || "";
  document.getElementById("f_correct").value = q.正解 || "A";
  document.getElementById("f_explain").value = q.解説 || "";
  document.getElementById("f_pitfall").value = q.間違えやすい理由 || "";
  document.getElementById("f_voice").value = q.音声用文章 || "";

  document.getElementById("modalBackdrop").classList.add("show");
}
function closeModal() {
  document.getElementById("modalBackdrop").classList.remove("show");
}

function handleSave(e) {
  e.preventDefault();
  const id = document.getElementById("f_id").value || `q-${Date.now()}`;
  const record = {
    id,
    資格: document.getElementById("f_cert").value,
    分野: document.getElementById("f_field").value,
    難易度: document.getElementById("f_diff").value,
    頻出度: Number(document.getElementById("f_freq").value),
    問題: document.getElementById("f_q").value,
    選択肢A: document.getElementById("f_a").value,
    選択肢B: document.getElementById("f_b").value,
    選択肢C: document.getElementById("f_c").value,
    選択肢D: document.getElementById("f_d").value,
    正解: document.getElementById("f_correct").value,
    解説: document.getElementById("f_explain").value,
    間違えやすい理由: document.getElementById("f_pitfall").value,
    音声用文章: document.getElementById("f_voice").value
  };

  const existingIdx = workingQuestions.findIndex(x => x.id === id);
  if (existingIdx >= 0) workingQuestions[existingIdx] = record;
  else workingQuestions.push(record);

  persistOverrides();
  renderTable();
  closeModal();
}

function deleteQuestion(id) {
  if (!confirm("この問題を削除しますか？")) return;
  workingQuestions = workingQuestions.filter(x => x.id !== id);
  persistOverrides();
  renderTable();
}

function renderPreview() {
  const area = document.getElementById("previewArea");
  area.innerHTML = workingQuestions.map(q => `
    <div class="q-card">
      <div class="q-meta"><span>${escapeHtml(q.分野)}</span><span>${escapeHtml(q.難易度)}</span></div>
      <div class="q-text">${escapeHtml(q.問題)}</div>
      ${["A","B","C","D"].filter(c => (q["選択肢"+c]||"").trim()!=="").map(c => `<div class="choice ${c===q.正解 ? "is-correct-preview" : ""}">${c}. ${escapeHtml(q["選択肢"+c])}</div>`).join("")}
      <div class="result-box correct mt-md"><div class="title">解説</div>${escapeHtml(q.解説)}</div>
    </div>
  `).join("");
  area.scrollIntoView({ behavior: "smooth" });
}

function exportJson() {
  downloadFile("questions.json", JSON.stringify(workingQuestions, null, 2), "application/json");
}

function exportCsv() {
  const cols = ["id","資格","分野","難易度","頻出度","問題","選択肢A","選択肢B","選択肢C","選択肢D","正解","解説","間違えやすい理由","音声用文章"];
  const rows = [cols.join(",")];
  workingQuestions.forEach(q => {
    rows.push(cols.map(c => `"${String(q[c] ?? "").replace(/"/g, '""')}"`).join(","));
  });
  downloadFile("questions_for_sheets.csv", rows.join("\n"), "text/csv");
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

bootAdmin();
