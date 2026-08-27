/* ルーティング（ハッシュベース）とレンダリング */

const app = document.getElementById("app");
let ALL_QUESTIONS = [];
let INTRO_DATA = null;

const routes = {
  "#/": renderHome,
  "#/quiz": renderQuiz,       // 一問一答・四択（同じエンジン、出題形式は同じ4択データを使う）
  "#/exam": renderExam,       // 模擬試験
  "#/settings": renderSettings,
  "#/stats": renderStats,
  "#/listening": renderListening,
  "#/updates": renderUpdates
};

async function boot() {
  ALL_QUESTIONS = await StudyOS.loadQuestions();
  window.addEventListener("hashchange", route);
  route();
}

function route() {
  const hash = location.hash || "#/";
  const path = hash.split("?")[0];
  // 聞き流し画面から離れるときは読み上げを必ず止める
  if (path !== "#/listening" && "speechSynthesis" in window) {
    stopListening();
  }
  const handler = routes[path] || renderHome;
  handler();
}

function certLabel() {
  const settings = StudyOS.loadSettings();
  return settings.field === "すべて" ? "消防設備士乙6類" : settings.field;
}

function setAppbar(title) {
  document.getElementById("appbarTitle").textContent = title;
  document.getElementById("appbarCert").textContent = certLabel();
}

/* ===== ホーム ===== */
function renderHome() {
  setAppbar("Study OS");
  const stats = StudyOS.getStats(ALL_QUESTIONS);
  const breakdown = StudyOS.getFieldBreakdown(ALL_QUESTIONS);
  app.innerHTML = `
    <div class="stats-bar">
      <div class="stat"><div class="num">${stats.accuracy}%</div><div class="label">正答率</div></div>
      <div class="stat"><div class="num">${stats.streak}</div><div class="label">連続正解</div></div>
      <div class="stat"><div class="num">${stats.answeredQuestions}/${stats.totalQuestions}</div><div class="label">学習済み</div></div>
    </div>
    ${renderFieldBreakdown(breakdown)}
    <div class="menu-grid">
      <button class="menu-card" onclick="location.hash='#/quiz?mode=one'"><span class="icon">✏️</span><span class="label">一問一答</span></button>
      <button class="menu-card" onclick="location.hash='#/listening'"><span class="icon">🎧</span><span class="label">聞き流し</span></button>
      <button class="menu-card" onclick="location.hash='#/stats'"><span class="icon">📊</span><span class="label">学習記録</span></button>
      <button class="menu-card" onclick="location.hash='#/settings'"><span class="icon">⚙️</span><span class="label">設定</span></button>
      <button class="menu-card" onclick="location.hash='#/updates'"><span class="icon">🆕</span><span class="label">更新履歴</span></button>
    </div>
    ${renderBetaNotice()}
  `;
}

function renderBetaNotice() {
  return `
    <details class="beta-notice">
      <summary>ベータ版について</summary>
      <ul>
        <li>本アプリは消防設備士乙6類試験対策のベータ版です。問題数・機能は今後変更される場合があります。</li>
        <li>収録問題は公開情報・参考資料等をもとに、学習用に再構成しています。実際の試験内容・出題傾向を保証するものではありません。学習の補助としてご利用ください。</li>
        <li>ご利用期間の目安は試験日までです（試験日は別途ご案内します）。</li>
        <li>本サービスの利用または結果(試験の合否等)について、当方は責任を負いかねます。</li>
        <li>ご購入後の返金は原則行いません。ただしアプリが利用できない等の技術的な不具合があった場合はご相談ください。</li>
        <li>本アプリのURL・パスワードのご購入者以外への共有はご遠慮ください。</li>
        <li>ご不明点・不具合報告は購入時にご案内した連絡先までお願いします。</li>
      </ul>
    </details>
  `;
}

function renderFieldBreakdown(breakdown) {
  const rows = breakdown.map(f => `
    <div class="field-row">
      <div class="field-row-head">
        <span class="field-name">${escapeHtml(f.field)}</span>
        <span class="field-status field-status--${statusClass(f.status)}">${escapeHtml(f.statusLabel)}</span>
      </div>
      <div class="field-bar-track"><div class="field-bar-fill field-bar-fill--${statusClass(f.status)}" style="width:${f.accuracy}%"></div></div>
      <div class="field-row-note">正答率${f.accuracy}%（${f.attempted}/${f.totalQuestions}問学習）</div>
    </div>
  `).join("");

  return `
    <div class="field-breakdown">
      <div class="field-breakdown-title">公式5分野の理解度</div>
      ${rows}
    </div>
  `;
}

function statusClass(status) {
  switch (status) {
    case "未着手": return "todo";
    case "要注意": return "warn";
    case "学習中": return "mid";
    case "高得点ペース": return "good";
    default: return "todo";
  }
}

/* ===== イントロ実践問題（正本の代表5問） ===== */
let introState = { index: 0 };

function renderIntro() {
  setAppbar("イントロ実践問題");
  const questions = INTRO_DATA?.questions || [];
  const question = questions[introState.index];
  if (!question) {
    app.innerHTML = `
      <a class="back-link" href="#/">← ホームへ戻る</a>
      <div class="empty-state">イントロ問題を読み込めませんでした。</div>
    `;
    return;
  }

  app.innerHTML = `
    <a class="back-link" href="#/">← ホームへ戻る</a>
    <div class="intro-progress">試作 ${introState.index + 1} / ${questions.length}問（原本全60問）</div>
    <form class="q-card" id="introForm">
      <div class="q-meta"><span>第${question.chapter}章 問${question.questionNumber}</span><span>${question.field}</span></div>
      <div class="q-text">${escapeHtml(question.prompt)}</div>
      ${question.passage ? `<div class="intro-passage">${formatIntroText(question.passage)}</div>` : ""}
      ${question.scenario ? `<div class="intro-passage">${escapeHtml(question.scenario)}</div>` : ""}
      ${renderIntroInputs(question)}
      ${question.visual?.required ? `<div class="intro-warning">🖼 公開用の独自図版は準備中です。現在は選択肢の説明文で回答してください。</div>` : ""}
      <div id="introResult"></div>
      <button class="next-btn" type="submit">回答する</button>
    </form>
  `;
  document.getElementById("introForm").onsubmit = event => {
    event.preventDefault();
    gradeIntroQuestion(question);
  };
}

function renderIntroInputs(question) {
  if (question.type === "fill_match") {
    return ["A", "B", "C", "D"].map(label => `
      <label class="intro-select-label">［${label}］
        <select name="mapping-${label}" class="intro-select" required>
          <option value="">選択してください</option>
          ${question.options.map(option => `<option value="${option.id}">${option.id}. ${escapeHtml(option.text)}</option>`).join("")}
        </select>
      </label>
    `).join("");
  }
  if (question.type === "case_study") {
    return question.subquestions.map(sub => `
      <fieldset class="intro-subquestion">
        <legend>${escapeHtml(sub.prompt)}</legend>
        ${sub.options.map(option => introOption("radio", `sub-${sub.id}`, option)).join("")}
      </fieldset>
    `).join("");
  }
  const inputType = question.type === "multiple_choice" ? "checkbox" : "radio";
  return `<div class="intro-options">
    ${question.options.map(option => introOption(inputType, "answer", option)).join("")}
  </div>`;
}

function introOption(type, name, option) {
  return `<label class="intro-option"><input type="${type}" name="${name}" value="${option.id}"> <span>${option.id}. ${escapeHtml(option.text)}</span></label>`;
}

function gradeIntroQuestion(question) {
  const form = document.getElementById("introForm");
  const values = new FormData(form);
  let correct = false;
  let answerText = "";

  if (question.answer.kind === "mapping") {
    const expected = question.answer.value;
    correct = Object.entries(expected).every(([key, value]) => values.get(`mapping-${key}`) === value);
    answerText = Object.entries(expected).map(([key, value]) => `${key}=${value}`).join("、");
  } else if (question.answer.kind === "multiple") {
    const selected = values.getAll("answer").sort();
    const expected = [...question.answer.value].sort();
    correct = JSON.stringify(selected) === JSON.stringify(expected);
    answerText = expected.join("、");
  } else if (question.answer.kind === "compound") {
    const expected = question.answer.value;
    correct = Object.entries(expected).every(([key, value]) => values.get(`sub-${key}`) === value);
    answerText = Object.entries(expected).map(([key, value]) => `${key}=${value}`).join("、");
  } else {
    correct = values.get("answer") === question.answer.value;
    answerText = question.answer.value;
  }

  document.querySelectorAll("#introForm input, #introForm select").forEach(input => input.disabled = true);
  const result = document.getElementById("introResult");
  result.innerHTML = `
    <div class="result-box ${correct ? "correct" : "wrong"}">
      <div class="title">${correct ? "⭕ 正解！" : "❌ 不正解"}</div>
      <div><strong>正解：${escapeHtml(answerText)}</strong></div>
      <div class="mt-sm">${escapeHtml(question.explanation)}</div>
      <div class="pitfall-note">⚠ ${escapeHtml(question.pitfall)}</div>
    </div>
    <button type="button" class="next-btn" id="introNext">${introState.index + 1 < (INTRO_DATA?.questions.length || 0) ? "次の問題へ" : "最初から見る"}</button>
  `;
  form.querySelector('button[type="submit"]').hidden = true;
  document.getElementById("introNext").onclick = () => {
    introState.index = introState.index + 1 < INTRO_DATA.questions.length ? introState.index + 1 : 0;
    renderIntro();
  };
}

function formatIntroText(text) {
  return escapeHtml(text).replace(/［([A-D])］/g, '<strong class="intro-blank">［$1］</strong>');
}

/* ===== 利用者向け更新履歴 ===== */
async function renderUpdates() {
  setAppbar("更新履歴");
  app.innerHTML = `<a class="back-link" href="#/">← ホームへ戻る</a><div class="empty-state">読み込み中…</div>`;
  try {
    const data = await StudyOS.loadReleases();
    app.innerHTML = `
      <a class="back-link" href="#/">← ホームへ戻る</a>
      ${data.releases.map(release => `
        <section class="q-card release-card">
          <div class="release-heading"><strong>${escapeHtml(release.version)}</strong><span>${escapeHtml(release.date)}</span></div>
          ${releaseSection("新機能", release.newFeatures)}
          ${releaseSection("改善", release.improvements)}
          ${releaseSection("不具合修正", release.bugFixes)}
          ${releaseSection("既知の問題", release.knownIssues)}
          ${releaseSection("次回予定", release.next)}
        </section>
      `).join("")}
    `;
  } catch (error) {
    app.innerHTML = `<a class="back-link" href="#/">← ホームへ戻る</a><div class="empty-state">更新履歴を読み込めませんでした。</div>`;
  }
}

function releaseSection(title, items) {
  if (!items?.length) return "";
  return `<div class="release-section"><h3>${title}</h3><ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`;
}

/* ===== 出題セット作成（設定を反映） ===== */
function buildQuestionSet() {
  const settings = StudyOS.loadSettings();
  let pool = ALL_QUESTIONS.slice();
  if (settings.difficulty !== "すべて") {
    pool = pool.filter(q => q.難易度 === settings.difficulty);
  }
  if (settings.field !== "すべて") {
    pool = pool.filter(q => q.分野 === settings.field);
  }
  pool = StudyOS.filterByMode(pool, settings.mode);
  pool = StudyOS.shuffle(pool);
  return pool.slice(0, settings.questionCount || pool.length);
}

/* ===== 一問一答・四択（即時採点） ===== */
let quizState = { queue: [], index: 0 };

function renderQuiz() {
  const params = new URLSearchParams((location.hash.split("?")[1] || ""));
  const mode = params.get("mode") === "four" ? "四択問題" : "一問一答";
  setAppbar(mode);

  if (quizState.index === 0 || quizState.queue.length === 0) {
    quizState.queue = buildQuestionSet();
    quizState.index = 0;
  }
  renderQuestionCard();
}

function renderQuestionCard() {
  const q = quizState.queue[quizState.index];
  if (!q) {
    app.innerHTML = `<div class="empty-state">この条件の問題がありません。<br>設定を見直してください。</div>
      <a class="back-link" href="#/settings">⚙️ 設定へ</a>`;
    return;
  }

  // 選択肢の並び順を毎回シャッフルする（正解の位置が固定だと配置で覚えてしまうため）
  const choices = shuffledChoices(q);
  quizState.currentChoices = choices;
  app.innerHTML = `
    <a class="back-link" href="#/">← ホームへ戻る</a>
    <div class="q-card">
      <div class="q-meta"><span>${q.分野}</span><span>${q.難易度}</span><span>${quizState.index + 1} / ${quizState.queue.length}問</span></div>
      <div class="q-text">${escapeHtml(q.問題)}</div>
      <div id="choiceList">
        ${choices.map(({ orig, display }) => `<button class="choice" data-choice="${orig}">${q.形式 === "○×" ? escapeHtml(q["選択肢" + orig]) : display + ". " + escapeHtml(q["選択肢" + orig])}</button>`).join("")}
      </div>
      <div id="resultArea"></div>
    </div>
  `;

  document.querySelectorAll(".choice").forEach(btn => {
    btn.onclick = () => answerQuestion(q, btn.dataset.choice);
  });
}

function answerQuestion(q, choice) {
  const correct = choice === q.正解;
  StudyOS.recordAnswer(q.id, correct);

  document.querySelectorAll(".choice").forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.choice === q.正解) btn.classList.add("correct");
    else if (btn.dataset.choice === choice) btn.classList.add("wrong");
  });

  // 表示上の正解ラベルは、今回シャッフルされた並びでの表示記号に変換する
  const correctEntry = (quizState.currentChoices || []).find(c => c.orig === q.正解);
  const correctDisplay = correctEntry ? correctEntry.display : q.正解;

  const box = document.getElementById("resultArea");
  box.innerHTML = `
    <div class="result-box ${correct ? "correct" : "wrong"}">
      <div class="title">${correct ? "⭕ 正解！" : "❌ 不正解"}</div>
      <div><strong>正解: ${q.形式 === "○×" ? escapeHtml(q["選択肢" + q.正解]) : correctDisplay}</strong></div>
      <div class="mt-sm">${escapeHtml(q.解説)}</div>
      ${!correct ? `<div class="pitfall-note">⚠ ${escapeHtml(q.間違えやすい理由 || "")}</div>` : ""}
    </div>
    <button class="next-btn" id="nextBtn">${quizState.index + 1 < quizState.queue.length ? "次の問題へ" : "結果を見る"}</button>
  `;
  document.getElementById("nextBtn").onclick = () => {
    quizState.index += 1;
    if (quizState.index >= quizState.queue.length) {
      location.hash = "#/stats";
      quizState.index = 0;
    } else {
      renderQuestionCard();
    }
  };
}

function availableChoices(q) {
  return ["A", "B", "C", "D"].filter(c => (q["選択肢" + c] || "").trim() !== "");
}

function shuffledChoices(q) {
  const letters = StudyOS.shuffle(availableChoices(q).slice());
  const displayLabels = ["A", "B", "C", "D"];
  return letters.map((orig, i) => ({ orig, display: displayLabels[i] }));
}

/* ===== 模擬試験（最後にまとめて採点） ===== */
let examState = { queue: [], answers: {} };

function renderExam() {
  setAppbar("模擬試験");
  if (examState.queue.length === 0) {
    examState.queue = buildQuestionSet();
    examState.answers = {};
  }
  renderExamCard(0);
}

function renderExamCard(idx) {
  const q = examState.queue[idx];
  if (!q) return renderExamResult();

  const choices = shuffledChoices(q);
  app.innerHTML = `
    <div class="q-card">
      <div class="q-meta"><span>模試</span><span>${idx + 1} / ${examState.queue.length}問</span></div>
      <div class="q-text">${escapeHtml(q.問題)}</div>
      <div>
        ${choices.map(({ orig, display }) => `<button class="choice" data-choice="${orig}">${q.形式 === "○×" ? escapeHtml(q["選択肢" + orig]) : display + ". " + escapeHtml(q["選択肢" + orig])}</button>`).join("")}
      </div>
    </div>
  `;
  document.querySelectorAll(".choice").forEach(btn => {
    btn.onclick = () => {
      examState.answers[q.id] = btn.dataset.choice;
      renderExamCard(idx + 1);
    };
  });
}

function renderExamResult() {
  let correctCount = 0;
  examState.queue.forEach(q => {
    const ans = examState.answers[q.id];
    const correct = ans === q.正解;
    if (correct) correctCount++;
    StudyOS.recordAnswer(q.id, correct);
  });
  const total = examState.queue.length;
  const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  app.innerHTML = `
    <div class="q-card exam-result-card">
      <div class="exam-label">模擬試験 結果</div>
      <div class="exam-rate">${rate}%</div>
      <div>${correctCount} / ${total} 問正解</div>
      <button class="next-btn" onclick="examState.queue=[];location.hash='#/'">ホームへ戻る</button>
    </div>
  `;
}

/* ===== 学習記録 ===== */
function renderStats() {
  setAppbar("学習記録");
  const stats = StudyOS.getStats(ALL_QUESTIONS);
  app.innerHTML = `
    <a class="back-link" href="#/">← ホームへ戻る</a>
    <div class="stats-bar">
      <div class="stat"><div class="num">${stats.accuracy}%</div><div class="label">総合正答率</div></div>
      <div class="stat"><div class="num">${stats.streak}</div><div class="label">現在の連続正解</div></div>
      <div class="stat"><div class="num">${stats.bestStreak}</div><div class="label">自己ベスト</div></div>
    </div>
    <div class="q-card">
      <div class="q-text text-sm">学習済み ${stats.answeredQuestions} / ${stats.totalQuestions} 問</div>
    </div>
  `;
}

/* ===== 設定 ===== */
function renderSettings() {
  setAppbar("設定");
  const settings = StudyOS.loadSettings();
  const fields = ["すべて", ...new Set(ALL_QUESTIONS.map(q => q.分野))];

  app.innerHTML = `
    <a class="back-link" href="#/">← ホームへ戻る</a>
    <div class="q-card">
      <div class="field-group">
        <label>難易度</label>
        <div class="pill-group" data-key="difficulty">
          ${["すべて", "初級", "標準", "上級"].map(v => pillBtn(v, settings.difficulty)).join("")}
        </div>
      </div>
      <div class="field-group">
        <label>問題数</label>
        <div class="pill-group" data-key="questionCount">
          ${[10, 20, 30, 50].map(v => pillBtn(v, settings.questionCount)).join("")}
        </div>
      </div>
      <div class="field-group">
        <label>出題方法</label>
        <div class="pill-group" data-key="mode">
          ${["ランダム", "苦手のみ", "頻出のみ"].map(v => pillBtn(v, settings.mode)).join("")}
        </div>
      </div>
      <div class="field-group">
        <label>分野指定</label>
        <div class="pill-group" data-key="field">
          ${fields.map(v => pillBtn(v, settings.field)).join("")}
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll(".pill-group").forEach(group => {
    const key = group.dataset.key;
    group.querySelectorAll("button").forEach(btn => {
      btn.onclick = () => {
        const settings = StudyOS.loadSettings();
        settings[key] = isNaN(btn.dataset.value) ? btn.dataset.value : Number(btn.dataset.value);
        StudyOS.saveSettings(settings);
        renderSettings();
      };
    });
  });
}

function pillBtn(value, current) {
  const active = String(value) === String(current) ? "active" : "";
  return `<button class="${active}" data-value="${value}">${value}</button>`;
}

/* ===== 聞き流し ===== */
let listeningState = { queue: [], index: 0, playing: false, token: 0 };

function renderListening() {
  setAppbar("聞き流し");
  if (!("speechSynthesis" in window)) {
    app.innerHTML = `
      <a class="back-link" href="#/">← ホームへ戻る</a>
      <div class="empty-state">🎧 このブラウザは読み上げ機能に対応していません。</div>
    `;
    return;
  }
  if (listeningState.queue.length === 0) {
    listeningState.queue = buildQuestionSet();
    listeningState.index = 0;
  }
  listeningState.playing = false;
  renderListeningCard();
}

function renderListeningCard() {
  const q = listeningState.queue[listeningState.index];
  if (!q) {
    app.innerHTML = `
      <a class="back-link" href="#/">← ホームへ戻る</a>
      <div class="empty-state">🎧 これで全問終わりです。お疲れさまでした。</div>
    `;
    return;
  }
  app.innerHTML = `
    <a class="back-link" href="#/">← ホームへ戻る</a>
    <div class="q-card">
      <div class="q-meta"><span>${q.分野}</span><span>${listeningState.index + 1} / ${listeningState.queue.length}問</span></div>
      <div class="q-text">${escapeHtml(q.問題)}</div>
      <div id="listeningStatus" class="listening-status">▶ 再生ボタンを押してください</div>
      <button class="next-btn" id="listeningToggle">▶ 再生する</button>
      <div class="listening-controls">
        <button class="choice" id="listeningPrev">⏮ 前の問題</button>
        <button class="choice" id="listeningSkip">次の問題へ ⏭</button>
      </div>
    </div>
  `;
  document.getElementById("listeningToggle").onclick = toggleListening;
  document.getElementById("listeningPrev").onclick = () => {
    stopListening();
    listeningState.index = Math.max(0, listeningState.index - 1);
    renderListeningCard();
  };
  document.getElementById("listeningSkip").onclick = () => {
    stopListening();
    listeningState.index += 1;
    renderListeningCard();
  };
}

function setListeningStatus(text) {
  const el = document.getElementById("listeningStatus");
  if (el) el.textContent = text;
}

function stopListening() {
  listeningState.playing = false;
  listeningState.token += 1; // 進行中の読み上げシーケンスを無効化
  window.speechSynthesis.cancel();
  const btn = document.getElementById("listeningToggle");
  if (btn) btn.textContent = "▶ 再生する";
}

function toggleListening() {
  if (listeningState.playing) {
    stopListening();
    setListeningStatus("⏸ 一時停止しました");
    return;
  }
  listeningState.playing = true;
  document.getElementById("listeningToggle").textContent = "⏸ 停止する";
  playCurrentQuestion();
}

function speak(text, token) {
  return new Promise(resolve => {
    if (listeningState.token !== token || !text) { resolve(); return; }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    utter.rate = 1.0;
    utter.onend = resolve;
    utter.onerror = resolve;
    window.speechSynthesis.speak(utter);
  });
}

async function playCurrentQuestion() {
  const token = listeningState.token;
  const q = listeningState.queue[listeningState.index];
  if (!q) return;

  try {
    setListeningStatus("🔊 問題を読み上げ中…");
    await speak(q.問題, token);
    if (listeningState.token !== token) return;

    setListeningStatus("⏳ 考え中…（4秒）");
    await new Promise(r => setTimeout(r, 4000));
    if (listeningState.token !== token) return;

    const correctText = q.形式 === "○×" ? q["選択肢" + q.正解] : q.正解;
    setListeningStatus("🔊 正解を読み上げ中…");
    await speak(`正解は、${correctText}です。`, token);
    if (listeningState.token !== token) return;

    setListeningStatus("🔊 解説を読み上げ中…");
    await speak(q.解説, token);
    if (listeningState.token !== token) return;

    if (q.間違えやすい理由) {
      setListeningStatus("🔊 間違えやすいポイントを読み上げ中…");
      await speak(`間違えやすいポイントです。${q.間違えやすい理由}`, token);
      if (listeningState.token !== token) return;
    }

    setListeningStatus("⏳ 次の問題へ…");
    await new Promise(r => setTimeout(r, 1500));
    if (listeningState.token !== token) return;

    listeningState.index += 1;
    if (listeningState.index >= listeningState.queue.length) {
      listeningState.playing = false;
      renderListeningCard();
      return;
    }
    renderListeningCard();
    document.getElementById("listeningToggle").textContent = "⏸ 停止する";
    playCurrentQuestion();
  } catch (e) {
    // 停止された場合はここに来る（正常系）
  }
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

StudyOSGate.protect("learner", boot);
