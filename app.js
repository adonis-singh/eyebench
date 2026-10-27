"use strict";

/* theme toggle: data-theme is set pre-paint in index.html */
const themeBtn = document.getElementById("theme-toggle");
const paintThemeBtn = () => {
  themeBtn.textContent = document.documentElement.dataset.theme === "dark" ? "\u2600" : "\u263e";
};
themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
  paintThemeBtn();
});
paintThemeBtn();

const fmtTok = (t) => (t >= 1e6 ? (t / 1e6).toFixed(2) + "M" : Math.round(t / 1e3) + "k");
const fmtUsd = (v) => "$" + (v >= 100 ? v.toFixed(0) : v.toFixed(2));

const VENDOR_LABELS = {
  openai: "OpenAI", anthropic: "Anthropic", google: "Google", xai: "xAI",
  moonshot: "Moonshot", qwen: "Qwen", meta: "Meta",
  "thinking-machines": "Thinking Machines", "z-ai": "Z.ai", deepseek: "DeepSeek",
  mistral: "Mistral",
};

/* export-frontier.py sorts runs by (vendor, model, effort), so each model's
   points arrive in ascending effort order */
const dsSeries = (() => {
  const by = new Map();
  for (const r of FRONTIER.runs) {
    if (!by.has(r.model)) by.set(r.model, { model: r.model, vendor: r.vendor, pts: [] });
    by.get(r.model).pts.push(r);
  }
  return [...by.values()];
})();

/* ---------------- leaderboard: each model at its highest effort ---------------- */

const boardRows = dsSeries.map((s) => {
  const r = s.pts[s.pts.length - 1]; // highest measured effort
  const p = r.accuracy_pct / 100;
  return {
    runSlug: r.run_slug,
    model: r.model,
    vendor: r.vendor,
    effort: r.effort,
    acc: r.accuracy_pct,
    stderr: Math.sqrt((p * (1 - p)) / r.n) * 100,
    correct: r.correct,
    n: r.n,
    cost: r.cost_usd,
    costPerCorrect: r.correct ? r.cost_usd / r.correct : null,
    outTok: r.output_tokens,
  };
});

/* hero: best single run in the data */
{
  const best = FRONTIER.runs.reduce((a, b) => (b.accuracy_pct > a.accuracy_pct ? b : a));
  document.getElementById("sota-score").textContent = `${best.correct}/${best.n}`;
  const name = best.model.split("-").map((s) => (s === "gpt" ? "GPT" : s[0].toUpperCase() + s.slice(1))).join("-");
  document.getElementById("sota-model").textContent = `${name} at ${best.effort} reasoning`;
}

const state = { key: "acc", dir: -1 };

function renderBoard() {
  const rows = [...boardRows].sort((a, b) => {
    const av = a[state.key] ?? Infinity;
    const bv = b[state.key] ?? Infinity;
    return (av - bv) * state.dir || b.acc - a.acc;
  });
  const tbody = document.querySelector("#lb tbody");
  tbody.innerHTML = rows
    .map((r, i) => {
      const w = r.acc;
      const wl = Math.max(0, r.acc - r.stderr);
      const wr = Math.min(100, r.acc + r.stderr);
      return `<tr data-run="${r.runSlug}">
        <td class="num">${i + 1}</td>
        <td><span class="model-cell">
          <img class="picon" src="icons/${r.vendor}.svg" alt="" loading="lazy">
          <span class="mname">${r.model}</span><span class="pill">${r.effort}</span>
        </span></td>
        <td class="barwrap"><div class="bar">
          <div class="fill v-${r.vendor}" style="width:${w}%"></div>
          <div class="whisker" style="left:${wl}%"></div>
          <div class="whisker" style="left:${wr}%"></div>
        </div></td>
        <td class="num score"><b>${r.correct}</b><span class="of">/${r.n}</span></td>
        <td class="num">${fmtUsd(r.cost)}</td>
        <td class="num">${r.costPerCorrect === null ? "—" : fmtUsd(r.costPerCorrect)}</td>
        <td class="num">${fmtTok(r.outTok)}</td>
      </tr>`;
    })
    .join("");
}

document.querySelectorAll("#lb th.sortable").forEach((th) => {
  th.tabIndex = 0;
  const activate = () => {
    const key = th.dataset.key;
    state.dir = state.key === key ? -state.dir : key === "acc" ? -1 : 1;
    state.key = key;
    document.querySelectorAll("#lb th.sortable").forEach((h) => h.removeAttribute("aria-sort"));
    th.setAttribute("aria-sort", state.dir === -1 ? "descending" : "ascending");
    renderBoard();
  };
  th.addEventListener("click", activate);
  th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
});

document.querySelector('#lb th[data-key="acc"]').setAttribute("aria-sort", "descending");
renderBoard();
