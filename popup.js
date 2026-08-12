const DEFAULTS = {
  enabled: true,
  fontSize: 26,
  speed: 200,
  opacity: 85,
  area: 75,
  showAuthor: false
};

const UNITS = {
  fontSize: ' px',
  speed: ' px/s',
  opacity: ' %',
  area: ' %'
};

function updateLabel(key, value) {
  const label = document.getElementById(key + 'Val');
  if (label) label.textContent = value + (UNITS[key] || '');
}

chrome.storage.sync.get(DEFAULTS, (settings) => {
  for (const key of Object.keys(DEFAULTS)) {
    const input = document.getElementById(key);
    if (!input) continue;

    if (input.type === 'checkbox') {
      input.checked = settings[key];
      input.addEventListener('change', () => {
        chrome.storage.sync.set({ [key]: input.checked });
      });
    } else {
      input.value = settings[key];
      updateLabel(key, settings[key]);
      input.addEventListener('input', () => {
        const v = Number(input.value);
        updateLabel(key, v);
        chrome.storage.sync.set({ [key]: v });
      });
    }
  }
});
