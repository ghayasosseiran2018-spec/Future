const STORAGE_KEY = 'overwatch_state_v1';

export function loadState(defaultStateFactory) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStateFactory();
    const parsed = JSON.parse(raw);
    return { ...defaultStateFactory(), ...parsed };
  } catch (err) {
    console.warn('OVERWATCH: failed to load stored state, resetting.', err);
    return defaultStateFactory();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `overwatch-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importStateFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
