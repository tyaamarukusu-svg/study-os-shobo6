/*
 * データ層。
 * 今は data/questions.json（Google Sheetsと同じ列構成）を読むだけだが、
 * 将来Google Sheetsに差し替えるときは loadQuestions() の中身だけ変えればよい。
 * 列構成: ID / 資格 / 分野 / 難易度 / 頻出度 / 問題 / 選択肢A-D / 正解 / 解説 / 間違えやすい理由 / 音声用文章
 */

const StudyOS = (() => {
  const STORAGE_PROGRESS = "studyOS_progress_v1";
  const STORAGE_SETTINGS = "studyOS_settings_v1";

  let cache = null;
  let introCache = null;
  let releasesCache = null;

  async function loadQuestions() {
    if (cache) return cache;
    // 管理者画面での編集は studyOS_admin_overrides_v1 に保存される。あればそちらを優先。
    // ここをGoogle Sheets APIのfetchに差し替えれば本番連携になる
    const overrides = localStorage.getItem("studyOS_admin_overrides_v1");
    if (overrides) {
      try {
        cache = _excludeUnsellable(JSON.parse(overrides));
        return cache;
      } catch { /* fall through to file */ }
    }
    const res = await fetch("data/questions.json", { cache: "no-store" });
    cache = _excludeUnsellable(await res.json());
    return cache;
  }

  // 根拠が確認できていない問題（販売対象: false）は出題プールから除外する
  function _excludeUnsellable(questions) {
    return questions.filter(q => q.販売対象 !== false);
  }

  async function loadIntroQuestions() {
    if (introCache) return introCache;
    const res = await fetch("data/intro_questions.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`イントロ問題を読み込めませんでした (${res.status})`);
    introCache = await res.json();
    return introCache;
  }

  async function loadReleases() {
    if (releasesCache) return releasesCache;
    const res = await fetch("data/releases.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`更新履歴を読み込めませんでした (${res.status})`);
    releasesCache = await res.json();
    return releasesCache;
  }

  function invalidateCache() {
    cache = null;
  }

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_PROGRESS)) || { answers: {}, streak: 0, bestStreak: 0 };
    } catch {
      return { answers: {}, streak: 0, bestStreak: 0 };
    }
  }

  function saveProgress(progress) {
    localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(progress));
  }

  function recordAnswer(questionId, correct) {
    const progress = loadProgress();
    const history = progress.answers[questionId] || { attempts: 0, correct: 0, lastResult: null };
    history.attempts += 1;
    if (correct) history.correct += 1;
    history.lastResult = correct;
    progress.answers[questionId] = history;

    if (correct) {
      progress.streak = (progress.streak || 0) + 1;
      progress.bestStreak = Math.max(progress.bestStreak || 0, progress.streak);
    } else {
      progress.streak = 0;
    }
    saveProgress(progress);
    return progress;
  }

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_SETTINGS)) || {
        difficulty: "標準",
        questionCount: 10,
        mode: "ランダム",
        field: "すべて"
      };
    } catch {
      return { difficulty: "標準", questionCount: 10, mode: "ランダム", field: "すべて" };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
  }

  function getStats(questions) {
    const progress = loadProgress();
    const answered = Object.keys(progress.answers).length;
    let totalAttempts = 0, totalCorrect = 0;
    Object.values(progress.answers).forEach(h => {
      totalAttempts += h.attempts;
      totalCorrect += h.correct;
    });
    const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
    return {
      totalQuestions: questions.length,
      answeredQuestions: answered,
      accuracy,
      streak: progress.streak || 0,
      bestStreak: progress.bestStreak || 0
    };
  }

  // 消防設備士乙6類の公式分野（機械に関する基礎的知識・消防関係法令・消火器の構造機能整備・鑑別等）ごとの
  // 学習状況を集計する。判定は「問題単位のタグ」ではなく「利用者の回答履歴」ベース。
  // ※教材の全体構成が判明次第、正式な章立てに合わせて調整する。
  const OFFICIAL_FIELDS = ["機械に関する基礎的知識", "消防関係法令", "消火器の構造・機能・整備", "消火器の規格", "鑑別等（実技）"];

  function getFieldBreakdown(questions) {
    const progress = loadProgress();
    return OFFICIAL_FIELDS.map(field => {
      const fieldQuestions = questions.filter(q => q.公式分野 === field);
      let attempted = 0, totalAttempts = 0, totalCorrect = 0;
      fieldQuestions.forEach(q => {
        const h = progress.answers[q.id];
        if (h) {
          attempted += 1;
          totalAttempts += h.attempts;
          totalCorrect += h.correct;
        }
      });
      const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

      let status, statusLabel;
      if (attempted === 0) {
        status = "未着手"; statusLabel = "⚠ 未着手";
      } else if (accuracy < 60) {
        status = "要注意"; statusLabel = "⚠ 要注意";
      } else if (accuracy < 80) {
        status = "学習中"; statusLabel = "学習中";
      } else {
        status = "高得点ペース"; statusLabel = "◎ 高得点ペース";
      }
      // ⑤実務上の知識及び能力のみ本番で2問以上必要（他は1問以上）なので要注意時のみ注記する
      if (field === "実務上の知識及び能力" && (status === "要注意" || status === "未着手")) {
        statusLabel += "（本番は2問以上必要）";
      }

      return {
        field,
        totalQuestions: fieldQuestions.length,
        attempted,
        accuracy,
        status,
        statusLabel,
      };
    });
  }

  // 苦手のみ: 直近の結果が不正解 or 正答率が低いもの
  function filterByMode(questions, mode) {
    const progress = loadProgress();
    switch (mode) {
      case "苦手のみ":
        return questions.filter(q => {
          const h = progress.answers[q.id];
          if (!h) return false;
          return h.lastResult === false || (h.correct / h.attempts) < 0.6;
        });
      case "頻出のみ":
        return questions.filter(q => Number(q.頻出度) >= 4);
      default:
        return questions;
    }
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return {
    loadQuestions, loadIntroQuestions, loadReleases, invalidateCache,
    loadProgress, saveProgress, recordAnswer,
    loadSettings, saveSettings,
    getStats, getFieldBreakdown, filterByMode, shuffle
  };
})();
