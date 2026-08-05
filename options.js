const DEFAULT_PREFIX =
  "I reviewed your code and have the following comments. Please address them.";

const prefixEl = document.getElementById("prefix");
const statusEl = document.getElementById("status");

function setStatus(text) {
  statusEl.textContent = text;
  if (text) {
    setTimeout(() => {
      if (statusEl.textContent === text) statusEl.textContent = "";
    }, 1500);
  }
}

async function load() {
  const { prefix } = await chrome.storage.sync.get({ prefix: DEFAULT_PREFIX });
  prefixEl.value = prefix ?? DEFAULT_PREFIX;
}

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.sync.set({ prefix: prefixEl.value });
  setStatus("Saved");
});

document.getElementById("reset").addEventListener("click", async () => {
  prefixEl.value = DEFAULT_PREFIX;
  await chrome.storage.sync.set({ prefix: DEFAULT_PREFIX });
  setStatus("Reset");
});

load();
