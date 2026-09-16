const DEFAULT_PREFIX =
  "For each comment below: don't implement yet. Restate the comment, give brief context for the line(s), and if there's a decision, propose a recommended action with risk level when relevant. Stop after each topic and wait for me before continuing.";

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
