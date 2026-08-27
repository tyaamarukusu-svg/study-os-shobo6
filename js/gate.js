/*
 * ベータ版アクセスゲート。
 * 「セキュリティ対策」ではなく「購入者向けサービスであることの体験」として機能させる。
 * 静的サイトのため view-source すればパスワードは見えるが、V1では許容する。
 */
(() => {
  const CONFIG = {
    learner: {
      password: "unko2026",
      storageKey: "studyOS_beta_unlocked_v1",
      title: "Study OS ベータ版",
      message: "ご案内した合言葉を入力してください。",
    },
    admin: {
      password: "kanri-unko99",
      storageKey: "studyOS_admin_unlocked_v1",
      title: "管理者専用画面",
      message: "管理者用の合言葉を入力してください。",
    },
  };

  window.StudyOSGate = {
    /**
     * ロックが必要なら全画面オーバーレイを表示し、解除されるまで onUnlock を呼ばない。
     * 既に解除済みならすぐ onUnlock を呼ぶ。
     */
    protect(kind, onUnlock) {
      const cfg = CONFIG[kind];
      if (!cfg) throw new Error(`unknown gate kind: ${kind}`);

      if (localStorage.getItem(cfg.storageKey) === "1") {
        onUnlock();
        return;
      }

      const overlay = document.createElement("div");
      overlay.id = "gateOverlay";
      overlay.style.cssText = `
        position: fixed; inset: 0; background: #f5f7fb; z-index: 9999;
        display: flex; align-items: center; justify-content: center; padding: 20px;
        font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
      `;
      overlay.innerHTML = `
        <form id="gateForm" style="background:white; border-radius:18px; box-shadow:0 6px 18px rgba(30,60,120,0.08);
          padding:28px 24px; width:100%; max-width:340px; text-align:center;">
          <div style="font-size:16px; font-weight:800; margin-bottom:8px;">${cfg.title}</div>
          <div style="font-size:13px; color:#7a8199; margin-bottom:18px; line-height:1.6;">${cfg.message}</div>
          <input type="password" id="gatePassword" placeholder="パスワード" autocomplete="off"
            style="width:100%; box-sizing:border-box; padding:12px 14px; border:1.5px solid #e4e8f5; border-radius:10px; font-size:14px; margin-bottom:10px;">
          <div id="gateError" style="color:#ff5566; font-size:12px; min-height:16px; margin-bottom:6px;"></div>
          <button type="submit" style="width:100%; padding:12px; border:none; border-radius:10px;
            background:#2f6fed; color:white; font-weight:700; font-size:14px; cursor:pointer;">入る</button>
        </form>
      `;
      document.body.appendChild(overlay);

      const form = overlay.querySelector("#gateForm");
      const input = overlay.querySelector("#gatePassword");
      const errorEl = overlay.querySelector("#gateError");
      input.focus();

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (input.value === cfg.password) {
          localStorage.setItem(cfg.storageKey, "1");
          overlay.remove();
          onUnlock();
        } else {
          errorEl.textContent = "パスワードが違います";
          input.value = "";
          input.focus();
        }
      });
    },
  };
})();
