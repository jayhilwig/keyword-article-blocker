/* Keyword Article Blocker - content script (MV3) */

const DEFAULT_RULES = KAB_DEFAULT_RULES;
const STORAGE_KEYS = KAB_STORAGE_KEYS;

const EXCLUDED_HOSTS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "yahoo.",
  "baidu.",
  "startpage.",
  "ecosia.",
];

const IGNORED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME"]);
const IGNORED_SELECTORS = [
  "input",
  "textarea",
  "[contenteditable='true']",
  "[contenteditable='']",
  "[role='textbox']",
];

let cachedConfig = null;
let observer = null;
let mutationScanTimer = null;

init().catch(() => {});

async function init() {
  if (isExcludedHost(location.hostname)) return;

  cachedConfig = await loadConfig(location.hostname);
  if (cachedConfig.disabledOnThisSite) return;

  scheduleInitialScan();
  observeDOM();
  listenForConfigChanges();
}

async function loadConfig(hostname) {
  const res = await chrome.storage.local.get([
    STORAGE_KEYS.RULES,
    STORAGE_KEYS.DISABLED_SITES,
  ]);

  const rules = Array.isArray(res[STORAGE_KEYS.RULES])
    ? res[STORAGE_KEYS.RULES]
    : null;
  const disabledSites =
    res[STORAGE_KEYS.DISABLED_SITES] &&
    typeof res[STORAGE_KEYS.DISABLED_SITES] === "object"
      ? res[STORAGE_KEYS.DISABLED_SITES]
      : {};

  if (!rules) {
    await chrome.storage.local.set({ [STORAGE_KEYS.RULES]: DEFAULT_RULES });
  }

  const finalRules = rules ?? DEFAULT_RULES;

  return {
    hostname,
    disabledOnThisSite: !!disabledSites[hostname],
    rules: finalRules,
    enabledPatterns: flattenEnabledPatterns(finalRules),
  };
}

function flattenEnabledPatterns(rules) {
  const patterns = [];

  for (const rule of rules) {
    if (!rule || rule.enabled === false || !Array.isArray(rule.patterns))
      continue;

    for (const pattern of rule.patterns) {
      if (typeof pattern === "string" && pattern.trim()) {
        patterns.push({
          ruleLabel: rule.label || rule.id,
          pattern: pattern.trim(),
        });
      }
    }
  }

  return patterns;
}

function observeDOM() {
  observer = new MutationObserver((mutations) => {
    if (cachedConfig?.disabledOnThisSite) return;

    if (isCnbcHost()) {
      clearTimeout(mutationScanTimer);
      mutationScanTimer = setTimeout(() => {
        scanDocument();
      }, 600);
      return;
    }

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) scanSubtree(node);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function scheduleInitialScan() {
  const delay = isCnbcHost() ? 1800 : 0;
  window.setTimeout(() => {
    scanDocument();
  }, delay);
}

function listenForConfigChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes[STORAGE_KEYS.RULES] && !changes[STORAGE_KEYS.DISABLED_SITES])
      return;

    loadConfig(location.hostname).then((config) => {
      cachedConfig = config;

      if (config.disabledOnThisSite) {
        restoreAll();
      } else {
        scanDocument();
      }
    });
  });
}

function scanDocument() {
  for (const root of getScanRoots()) {
    scanSubtree(root);
  }
}

function getScanRoots() {
  const roots = [...document.querySelectorAll("article, main, [role='main']")];
  return roots.length ? roots : [document.body];
}

function scanSubtree(rootEl) {
  if (!cachedConfig?.enabledPatterns?.length) return;
  if (!(rootEl instanceof Element)) return;

  if (rootEl.closest?.("[data-kab-placeholder='true']")) return;
  if (rootEl.closest?.("[data-kab-hidden='true']")) return;
  if (rootEl.closest?.("[data-kab-revealed='true']")) return;

  for (const selector of IGNORED_SELECTORS) {
    if (rootEl.matches?.(selector) || rootEl.closest?.(selector)) return;
  }

  scanElementAttributes(rootEl);

  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (IGNORED_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(IGNORED_SELECTORS.join(",")))
        return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-kab-placeholder='true']"))
        return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-kab-hidden='true']"))
        return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-kab-revealed='true']"))
        return NodeFilter.FILTER_REJECT;

      const text = node.nodeValue;
      if (!text || text.trim().length < 6) return NodeFilter.FILTER_REJECT;

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node;
  let iterations = 0;

  while ((node = walker.nextNode())) {
    iterations++;
    if (iterations > 6000) break;

    const match = findFirstMatch(node.nodeValue, cachedConfig.enabledPatterns);
    if (!match) continue;

    const container = findContainerToHide(node.parentElement);
    if (!container) continue;

    hideContainer(container, match.ruleLabel, match.pattern);
  }
}

function scanElementAttributes(rootEl) {
  const selector = [
    "a[title]",
    "a[aria-label]",
    "[title]",
    "[aria-label]",
  ].join(",");
  const elements = [];

  if (rootEl.matches?.(selector)) elements.push(rootEl);
  rootEl.querySelectorAll?.(selector).forEach((el) => elements.push(el));

  for (const el of elements) {
    if (
      el.closest(
        "[data-kab-placeholder='true'], [data-kab-hidden='true'], [data-kab-revealed='true']",
      )
    ) {
      continue;
    }

    const isIgnored = IGNORED_SELECTORS.some((ignored) => {
      return el.matches?.(ignored) || el.closest?.(ignored);
    });

    if (isIgnored) continue;

    const attrText = [
      el.getAttribute("title"),
      el.getAttribute("aria-label"),
      el.textContent,
    ]
      .filter(Boolean)
      .join(" ");

    const match = findFirstMatch(attrText, cachedConfig.enabledPatterns);
    if (!match) continue;

    const container = findContainerToHide(el);
    if (!container) continue;

    hideContainer(container, match.ruleLabel, match.pattern);
  }
}

function findFirstMatch(text, enabledPatterns) {
  const lower = text.toLowerCase();

  for (const item of enabledPatterns) {
    const pattern = item.pattern.toLowerCase();
    if (pattern.length >= 2 && lower.includes(pattern)) return item;
  }

  return null;
}

function findContainerToHide(fromEl) {
  if (!fromEl) return null;

  if (
    fromEl.closest(
      "[data-kab-hidden='true'], [data-kab-placeholder='true'], [data-kab-revealed='true']",
    )
  ) {
    return null;
  }

  if (isBbcHost()) {
    const bbcCard = fromEl.closest(
      [
        "[data-indexcard='true']",
        "[data-testid='london-card']",
        "[data-testid='dundee-card']",
        "[data-testid='manchester-card']",
        "[data-testid='chester-card']",
        "[data-testid='cambridge-card']",
        "[data-testid='london-article']",
        "[data-testid='dundee-article']",
        "[data-testid='manchester-article']",
        "[data-testid='chester-article']",
        "[data-testid='cambridge-article']",
        "[data-testid='dundee-video']",
        "[data-testid='manchester-video']",
        "[data-testid='cambridge-video']",
        "[data-testid='dundee-live']",
      ].join(","),
    );

    if (bbcCard && isReasonableContainer(bbcCard)) return bbcCard;
    return null;
  }

  if (isCnbcHost()) {
    if (
      fromEl.closest(
        "header, nav, [id='GlobalNavigation'], .CNBCGlobalNav-container",
      )
    ) {
      return null;
    }

    const cnbcOuterCard = fromEl.closest(
      [
        ".RiverPlusCard-card",
        ".Card-card",
        ".FeaturedCard-container",
        ".SecondaryCard-container",
        "[data-test='Card']",
        "[class*='RiverPlusCard-card']",
      ].join(","),
    );

    if (cnbcOuterCard && isReasonableContainer(cnbcOuterCard))
      return cnbcOuterCard;

    const cnbcListCard = fromEl.closest(
      [
        ".LatestNews-item",
        ".TrendingNowItem-storyItem",
        ".PackageItem-link",
        "[class*='Card-']",
        "[class*='LatestNews-item']",
      ].join(","),
    );

    if (cnbcListCard && isReasonableContainer(cnbcListCard))
      return cnbcListCard;
    return null;
  }

  if (isCsMonitorHost()) {
    const csCard = fromEl.closest(
      [
        "article",
        "li",
        "[class*='story']",
        "[class*='Story']",
        "[class*='card']",
        "[class*='Card']",
        "[class*='promo']",
        "[class*='Promo']",
        "[class*='article']",
        "[class*='Article']",
      ].join(","),
    );

    if (csCard && isReasonableContainer(csCard)) return csCard;
    return null;
  }

  if (isTabumHost()) {
    const tabumSummaryItem = fromEl.closest(
      "li.text-\\[\\#232F3E\\].flex.items-start",
    );
    if (tabumSummaryItem && isReasonableContainer(tabumSummaryItem)) {
      return tabumSummaryItem;
    }

    const tabumSummaryIntro = fromEl.closest("p.mb-4.text-lg.leading-relaxed");
    if (tabumSummaryIntro && isReasonableContainer(tabumSummaryIntro)) {
      return tabumSummaryIntro;
    }
  }

  const path = [];
  let el = fromEl;

  while (el && el !== document.body && path.length < 30) {
    path.push(el);
    el = el.parentElement;
  }

  for (const candidate of path) {
    if (candidate.tagName === "ARTICLE" && isReasonableContainer(candidate)) {
      return candidate;
    }
  }

  for (const candidate of path) {
    if (
      candidate.getAttribute?.("role") === "article" &&
      isReasonableContainer(candidate)
    ) {
      return candidate;
    }
  }

  for (const candidate of path) {
    if (looksLikeCard(candidate) && isReasonableContainer(candidate)) {
      return candidate;
    }
  }

  for (const candidate of path) {
    if (isReasonableContainer(candidate)) return candidate;
  }

  return null;
}

function looksLikeCard(el) {
  if (!(el instanceof Element)) return false;
  if (
    ["HTML", "BODY", "MAIN", "HEADER", "FOOTER", "NAV"].includes(el.tagName)
  ) {
    return false;
  }

  const textLen = (el.innerText || "").trim().length;
  const linkCount = el.querySelectorAll?.("a")?.length || 0;
  const hasHeading = !!el.querySelector?.("h1, h2, h3");
  const classText = (el.className || "").toString().toLowerCase();

  if (hasHeading && textLen >= 60) return true;
  if (linkCount >= 2 && textLen >= 100) return true;
  if (
    /(card|story|article|post|entry|feed|tile|result|item|headline)/.test(
      classText,
    ) &&
    textLen >= 40
  ) {
    return true;
  }

  return false;
}

function isReasonableContainer(el) {
  if (!(el instanceof Element)) return false;
  if (el.hasAttribute("data-kab-hidden")) return false;
  if (el.hasAttribute("data-kab-placeholder")) return false;
  if (el.hasAttribute("data-kab-revealed")) return false;
  if (["HTML", "BODY"].includes(el.tagName)) return false;

  const idClass = `${el.id || ""} ${el.className || ""}`.toLowerCase();
  if (
    /(header|footer|nav|menu|sidebar)/.test(idClass) &&
    (el.innerText || "").length < 2000
  ) {
    return false;
  }

  const textLen = (el.innerText || "").trim().length;
  if (textLen < 20) return false;

  const rect = el.getBoundingClientRect?.();
  const area = rect ? rect.width * rect.height : 0;

  if (area > 2000000 || textLen > 25000) {
    const isArticleTag = el.tagName === "ARTICLE";
    const hasH1 = !!el.querySelector?.("h1");
    if (!(isArticleTag || hasH1)) return false;
  }

  return true;
}

function hideContainer(container, ruleLabel, pattern) {
  const target = getHideTarget(container);

  if (target.hasAttribute("data-kab-hidden")) return;
  if (target.hasAttribute("data-kab-revealed")) return;

  target.setAttribute("data-kab-hidden", "true");
  target.classList.add("kab-hidden");
  hideTargetElement(target);

  const placeholder = document.createElement(
    target.tagName === "LI" ? "li" : "div",
  );
  placeholder.className = "kab-placeholder";
  placeholder.setAttribute("data-kab-placeholder", "true");
  placeholder.setAttribute("role", "note");

  const safeRule = escapeHtml(ruleLabel);
  const safePattern = escapeHtml(pattern);

  placeholder.innerHTML = `
    <strong>Article hidden</strong>
    <div class="kab-meta">Matched: <em>${safeRule}</em></div>
    <div class="kab-meta">Keyword: <span title="${safePattern}">${truncate(safePattern, 48)}</span></div>
    <div>
      <button type="button" data-kab-action="show">Show</button>
    </div>
  `;

  applyPlaceholderStyles(placeholder);

  for (const eventName of [
    "pointerover",
    "pointerenter",
    "mouseover",
    "mouseenter",
  ]) {
    placeholder.addEventListener(eventName, (event) => {
      event.stopPropagation();
    });
  }

  const showBtn = placeholder.querySelector("[data-kab-action='show']");

  for (const eventName of ["pointerdown", "mousedown", "mouseup", "click"]) {
    showBtn?.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (eventName !== "click") return;

      target.classList.remove("kab-hidden");
      target.removeAttribute("data-kab-hidden");
      target.removeAttribute("data-kab-placeholder-id");
      target.setAttribute("data-kab-revealed", "true");
      restoreTargetElement(target);
      placeholder.remove();
      flashRevealedTarget(target);
    });
  }

  target.setAttribute("data-kab-placeholder-id", getOrAssignId(placeholder));
  placeholder.setAttribute("data-kab-target-id", getOrAssignId(target));

  target.parentNode?.insertBefore(placeholder, target);
}

function hideTargetElement(target) {
  const previousDisplay = target.style.getPropertyValue("display");
  const previousDisplayPriority = target.style.getPropertyPriority("display");

  target.setAttribute("data-kab-prev-display", previousDisplay);
  target.setAttribute(
    "data-kab-prev-display-priority",
    previousDisplayPriority,
  );
  target.style.setProperty("display", "none", "important");
}

function restoreTargetElement(target) {
  const previousDisplay = target.getAttribute("data-kab-prev-display") || "";
  const previousDisplayPriority =
    target.getAttribute("data-kab-prev-display-priority") || "";

  if (previousDisplay) {
    target.style.setProperty(
      "display",
      previousDisplay,
      previousDisplayPriority,
    );
  } else {
    target.style.removeProperty("display");
  }

  target.removeAttribute("data-kab-prev-display");
  target.removeAttribute("data-kab-prev-display-priority");
}

function flashRevealedTarget(target) {
  target.style.setProperty(
    "transition",
    "background-color 550ms ease, box-shadow 550ms ease",
    "important",
  );
  target.style.setProperty(
    "background-color",
    "rgba(255, 221, 87, 0.32)",
    "important",
  );
  target.style.setProperty(
    "box-shadow",
    "0 0 0 3px rgba(255, 193, 7, 0.38)",
    "important",
  );

  window.setTimeout(() => {
    target.style.setProperty(
      "background-color",
      "rgba(255, 221, 87, 0.18)",
      "important",
    );
    target.style.setProperty(
      "box-shadow",
      "0 0 0 2px rgba(255, 193, 7, 0.18)",
      "important",
    );
  }, 650);

  window.setTimeout(() => {
    target.style.removeProperty("background-color");
    target.style.removeProperty("box-shadow");
    target.style.removeProperty("transition");
  }, 1500);
}

function getHideTarget(container) {
  const link = container.closest?.("a[href]");

  if (link && link.contains(container)) {
    return link;
  }

  return container;
}

function applyPlaceholderStyles(placeholder) {
  placeholder.style.setProperty("display", "block", "important");
  placeholder.style.setProperty("box-sizing", "border-box", "important");
  placeholder.style.setProperty("min-height", "92px", "important");
  placeholder.style.setProperty("padding", "12px", "important");
  placeholder.style.setProperty("margin", "10px 0", "important");
  placeholder.style.setProperty("color", "#111827", "important");
  placeholder.style.setProperty("background", "#f9fafb", "important");
  placeholder.style.setProperty(
    "border",
    "1px solid rgba(0, 0, 0, 0.22)",
    "important",
  );
  placeholder.style.setProperty("border-radius", "8px", "important");
  placeholder.style.setProperty("opacity", "1", "important");
  placeholder.style.setProperty("visibility", "visible", "important");
  placeholder.style.setProperty("pointer-events", "auto", "important");
  placeholder.style.setProperty("text-decoration", "none", "important");
  placeholder.style.setProperty(
    "font",
    "13px/1.35 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    "important",
  );

  const button = placeholder.querySelector("[data-kab-action='show']");
  if (!button) return;

  button.style.setProperty("appearance", "auto", "important");
  button.style.setProperty("display", "inline-block", "important");
  button.style.setProperty("width", "auto", "important");
  button.style.setProperty("min-width", "52px", "important");
  button.style.setProperty("height", "auto", "important");
  button.style.setProperty("min-height", "30px", "important");
  button.style.setProperty("padding", "6px 10px", "important");
  button.style.setProperty("margin-top", "8px", "important");
  button.style.setProperty("color", "#111827", "important");
  button.style.setProperty("background", "#ffffff", "important");
  button.style.setProperty(
    "border",
    "1px solid rgba(0, 0, 0, 0.25)",
    "important",
  );
  button.style.setProperty("border-radius", "8px", "important");
  button.style.setProperty(
    "font",
    "13px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    "important",
  );
  button.style.setProperty("text-indent", "0", "important");
  button.style.setProperty("opacity", "1", "important");
  button.style.setProperty("visibility", "visible", "important");
  button.style.setProperty("overflow", "visible", "important");
  button.style.setProperty("cursor", "pointer", "important");
}

function restoreAll() {
  document.querySelectorAll("[data-kab-hidden='true']").forEach((el) => {
    el.classList.remove("kab-hidden");
    el.removeAttribute("data-kab-hidden");
    el.removeAttribute("data-kab-placeholder-id");
    restoreTargetElement(el);
  });

  document.querySelectorAll("[data-kab-revealed='true']").forEach((el) => {
    el.removeAttribute("data-kab-revealed");
  });

  document
    .querySelectorAll("[data-kab-placeholder='true']")
    .forEach((placeholder) => {
      placeholder.remove();
    });
}

function getOrAssignId(el) {
  const attr = "data-kab-id";
  let id = el.getAttribute(attr);

  if (!id) {
    id = "kab_" + Math.random().toString(36).slice(2, 10);
    el.setAttribute(attr, id);
  }

  return id;
}

function isExcludedHost(hostname) {
  const h = (hostname || "").toLowerCase();
  return EXCLUDED_HOSTS.some((x) => h.includes(x));
}

function isBbcHost() {
  const h = location.hostname.toLowerCase();
  return (
    h === "bbc.com" ||
    h.endsWith(".bbc.com") ||
    h === "bbc.co.uk" ||
    h.endsWith(".bbc.co.uk")
  );
}

function isCnbcHost() {
  const h = location.hostname.toLowerCase();
  return h === "cnbc.com" || h.endsWith(".cnbc.com");
}

function isCsMonitorHost() {
  const h = location.hostname.toLowerCase();
  return h === "csmonitor.com" || h.endsWith(".csmonitor.com");
}

function isTabumHost() {
  return location.hostname.toLowerCase().includes("tabum");
}

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
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
