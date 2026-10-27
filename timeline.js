"use strict";

/* Score by release date. Each model sits at its highest measured effort, as on the
   leaderboard. A lab's line steps up when one of its releases beats its previous best
   and runs on to the data's date. Uses dsSeries and VENDOR_LABELS from app.js. */

const tlModels = dsSeries.map((s) => s.pts[s.pts.length - 1]);
const tlDay = (d) => Date.parse(d + "T00:00:00Z");
const tlBest = (v) => Math.max(...tlModels.filter((m) => m.vendor === v).map((m) => m.accuracy_pct));
const tlVendors = [...new Set(tlModels.map((m) => m.vendor))].sort((a, b) => tlBest(b) - tlBest(a));
const tlActive = new Set(tlVendors);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function renderTL() {
  const W = 1012, H = 440, M = { t: 40, r: 128, b: 40, l: 50 };
  const IW = W - M.l - M.r, IH = H - M.t - M.b;
  const t0 = Math.min(...tlModels.map((m) => tlDay(m.released))) - 12 * 864e5;
  const t1 = tlDay(FRONTIER.generated);
  const x = (d) => M.l + ((tlDay(d) - t0) / (t1 - t0)) * IW;
  const y = (a) => M.t + (1 - a / 100) * IH;

  let g = "";
  for (let a = 0; a <= 100; a += 10)
    g += `<line x1="${M.l}" y1="${y(a)}" x2="${W - M.r}" y2="${y(a)}" class="dgrid"/>
          <text x="${M.l - 8}" y="${y(a) + 4}" text-anchor="end" class="dax">${a}%</text>`;
  const start = new Date(t0);
  for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)); d.getTime() <= t1; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const label = d.getUTCMonth() === 0 || g.indexOf("dmonth") === -1 ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : MONTHS[d.getUTCMonth()];
    g += `<line x1="${x(iso)}" y1="${M.t}" x2="${x(iso)}" y2="${H - M.b}" class="dgrid"/>
          <text x="${x(iso)}" y="${H - M.b + 18}" text-anchor="middle" class="dax dmonth">${label}</text>`;
  }
  g += `<text x="${M.l}" y="22" class="dtitle">EyeBench score</text>`;

  let lines = "", dots = "";
  const labels = [];
  for (const v of tlVendors.filter((v) => tlActive.has(v))) {
    const models = tlModels.filter((m) => m.vendor === v).sort((a, b) => tlDay(a.released) - tlDay(b.released) || b.accuracy_pct - a.accuracy_pct);
    let best = -1, path = "";
    for (const m of models) {
      const raises = m.accuracy_pct > best;
      if (raises) {
        path += best < 0 ? `M${x(m.released)},${y(m.accuracy_pct)}` : `H${x(m.released)}V${y(m.accuracy_pct)}`;
        best = m.accuracy_pct;
      }
      dots += `<circle class="tdot v-${v}${raises ? "" : " hollow"}" data-run="${m.run_slug}" cx="${x(m.released)}" cy="${y(m.accuracy_pct)}" r="4"/>`;
    }
    path += `H${W - M.r}`;
    lines += `<path class="tline v-${v}" data-v="${v}" d="${path}"/>`;
    labels.push({ v, ly: y(best) + 4 });
  }
  /* end-of-line lab names, pushed apart so they never overlap */
  labels.sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < labels.length; i++) labels[i].ly = Math.max(labels[i].ly, labels[i - 1].ly + 13);
  const names = labels.map(({ v, ly }) =>
    `<text class="dlab tname v-${v}" data-v="${v}" x="${W - M.r + 8}" y="${ly}">${VENDOR_LABELS[v]}</text>`).join("");

  const host = document.getElementById("tlchart");
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="EyeBench score of each model by its release date, with each lab's best score over time">
    ${g}${lines}${dots}${names}</svg>`;

  const tip = document.getElementById("tip");
  const byRun = new Map(tlModels.map((m) => [m.run_slug, m]));
  host.querySelectorAll(".tdot").forEach((c) => {
    c.addEventListener("mousemove", (e) => {
      const m = byRun.get(c.dataset.run);
      const [yy, mm, dd] = m.released.split("-");
      tip.hidden = false;
      tip.textContent = `${m.model} [${m.effort}] — ${m.accuracy_pct}% · released ${MONTHS[+mm - 1]} ${+dd}, ${yy}`;
      const right = e.clientX + 14 + tip.offsetWidth > window.innerWidth - 8;
      tip.style.left = (right ? e.clientX - 14 - tip.offsetWidth : e.clientX + 14) + "px";
      tip.style.top = e.clientY - 10 + "px";
    });
    c.addEventListener("mouseleave", () => (tip.hidden = true));
  });
}

const tlLegend = document.getElementById("tl-legend");
tlLegend.innerHTML = tlVendors
  .map((v) => `<button class="ds-chip v-${v}" data-v="${v}" type="button" aria-pressed="true"><i></i>${VENDOR_LABELS[v]}</button>`)
  .join("");
tlLegend.querySelectorAll(".ds-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const v = chip.dataset.v;
    if (tlActive.has(v)) tlActive.delete(v);
    else tlActive.add(v);
    chip.classList.toggle("off", !tlActive.has(v));
    chip.setAttribute("aria-pressed", String(tlActive.has(v)));
    renderTL();
  });
});
window.addEventListener("scroll", () => (document.getElementById("tip").hidden = true), { passive: true });

renderTL();
