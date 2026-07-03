const DEFAULT_RULES = KAB_DEFAULT_RULES;
const STORAGE_KEYS = KAB_STORAGE_KEYS;

function uid() {
  return "r_" + Math.random().toString(36).slice(2, 10);
}

async function loadRules() {
  const res = await chrome.storage.local.get([STORAGE_KEYS.RULES]);
  const rules = res[STORAGE_KEYS.RULES];

  if (!Array.isArray(rules)) {
    await chrome.storage.local.set({ [STORAGE_KEYS.RULES]: DEFAULT_RULES });
    return DEFAULT_RULES;
  }

  return rules;
}

async function saveRules(rules) {
  await chrome.storage.local.set({ [STORAGE_KEYS.RULES]: rules });
}

function renderRules(rules) {
  const tbody = document.getElementById("rulesTbody");
  tbody.innerHTML = "";

  for (const rule of rules) {
    const tr = document.createElement("tr");

    const tdOn = document.createElement("td");
    tdOn.className = "rule-controls";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = rule.enabled !== false;

    cb.addEventListener("change", async () => {
      const rules2 = await loadRules();
      const r = rules2.find((x) => x.id === rule.id);
      if (r) r.enabled = cb.checked;
      await saveRules(rules2);
    });

    tdOn.appendChild(cb);

    if (rule.type === "keyword") {
      const del = document.createElement("button");
      del.className = "icon-button danger";
      del.type = "button";
      del.title = "Delete this item";
      del.setAttribute("aria-label", "Delete this item");
      del.innerHTML = "🗑️";

      del.addEventListener("click", async () => {
        const rules2 = await loadRules();
        const next = rules2.filter((x) => x.id !== rule.id);
        await saveRules(next);
        renderRules(next);
      });

      tdOn.appendChild(del);
    }

    const tdLabel = document.createElement("td");
    tdLabel.innerHTML = `
      <div><strong>${escapeHtml(rule.label || rule.id)}</strong></div>
      <div class="muted"><span class="pill">${escapeHtml(rule.type || "rule")}</span></div>
    `;

    const tdPatterns = document.createElement("td");

    const ta = document.createElement("textarea");
    ta.rows = 3;
    ta.style.width = "100%";
    ta.style.padding = "8px 10px";
    ta.style.borderRadius = "10px";
    ta.style.border = "1px solid rgba(0,0,0,.25)";
    ta.value = Array.isArray(rule.patterns) ? rule.patterns.join("\n") : "";

    ta.addEventListener("change", async () => {
      const rules2 = await loadRules();
      const r = rules2.find((x) => x.id === rule.id);

      if (r) {
        r.patterns = ta.value
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      await saveRules(rules2);
    });

    tdPatterns.appendChild(ta);

    tr.appendChild(tdOn);
    tr.appendChild(tdLabel);
    tr.appendChild(tdPatterns);

    tbody.appendChild(tr);
  }
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return ch;
    }
  });
}

(async function init() {
  const addBtn = document.getElementById("addKeyword");
  const input = document.getElementById("newKeyword");
  const resetBtn = document.getElementById("resetDefaults");
  const applyBtn = document.getElementById("applySettings");

  const rules = await loadRules();
  renderRules(rules);

  addBtn.addEventListener("click", async () => {
    const val = (input.value || "").trim();
    if (!val) return;

    const rules2 = await loadRules();

    rules2.push({
      id: uid(),
      enabled: true,
      label: `Keyword: ${val}`,
      type: "keyword",
      patterns: [val],
    });

    await saveRules(rules2);
    input.value = "";
    renderRules(rules2);
  });

  resetBtn.addEventListener("click", async () => {
    await saveRules(DEFAULT_RULES);
    renderRules(DEFAULT_RULES);
  });

  applyBtn?.addEventListener("click", () => {
    applyBtn.textContent = "Applied";

    window.setTimeout(() => {
      applyBtn.textContent = "Apply";
    }, 1200);
  });
  const closeBtn = document.getElementById("closeOptions");

  closeBtn?.addEventListener("click", () => {
    window.close();
  });
})();
