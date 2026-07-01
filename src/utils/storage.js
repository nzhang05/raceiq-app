export const STORAGE_KEY = "raceiq:custom-races";

export async function loadCustomRaces() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveCustomRaces(races) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(races));
  } catch {
    /* storage unavailable — state still works for this session */
  }
}
