const STORAGE_KEYS = {
  DISABLED_SITES: "kab_disabled_sites"
};

async function getActiveHostname() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const url = new URL(tab.url);
    return url.hostname;
  } catch {
    return null;
  }
}

async function loadDisabledSites() {
  const res = await chrome.storage.local.get([STORAGE_KEYS.DISABLED_SITES]);
  const map = res[STORAGE_KEYS.DISABLED_SITES];
  return map && typeof map === "object" ? map : {};
}

async function saveDisabledSites(map) {
  await chrome.storage.local.set({ [STORAGE_KEYS.DISABLED_SITES]: map });
}

(async function init() {
  const hostname = await getActiveHostname();
  const siteLine = document.getElementById("siteLine");
  const toggle = document.getElementById("siteToggle");
  const openOptions = document.getElementById("openOptions");

  if (!hostname) {
    siteLine.textContent = "This page can’t be controlled.";
    toggle.disabled = true;
    return;
  }

  siteLine.textContent = hostname;

  const disabledSites = await loadDisabledSites();
  const isDisabled = !!disabledSites[hostname];

  // Checkbox means "enabled", so invert disabled flag
  toggle.checked = !isDisabled;

  toggle.addEventListener("change", async () => {
    const disabledSites2 = await loadDisabledSites();
    disabledSites2[hostname] = !toggle.checked;
    // If enabled, remove key to keep storage clean
    if (disabledSites2[hostname] === false) delete disabledSites2[hostname];

    await saveDisabledSites(disabledSites2);

    // Reload current tab so content script applies immediately
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.reload(tab.id);
  });

  openOptions.addEventListener("click", async () => {
    await chrome.runtime.openOptionsPage();
  });
})();