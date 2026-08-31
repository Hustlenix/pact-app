/**
 * Storage utilities for PACT
 * localStorage wrapper with API sync queue for offline support
 */

const STORAGE_KEYS = {
  SHARE_CODE: 'pact_shareCode',
  MEMBER_ID: 'pact_memberId',
  MEMBER_NAME: 'pact_memberName',
  PACT_NAME: 'pact_name',
  PACT_EMOJI: 'pact_emoji',
  HABITS: 'pact_habits',
  CHECKIN_QUEUE: 'pact_checkin_queue',
  LAST_SYNC: 'pact_last_sync',
  PACT_DATA: 'pact_full_data'
};

/**
 * Get API base URL from environment
 * @returns {string}
 */
function getApiBase() {
  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
}

/**
 * Generic localStorage getter with JSON parsing
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
export function getStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Generic localStorage setter with JSON stringification
 * @param {string} key
 * @param {*} value
 */
export function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('localStorage set failed:', e);
  }
}

/**
 * Remove item from localStorage
 * @param {string} key
 */
export function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('localStorage remove failed:', e);
  }
}

/**
 * Clear all PACT-related storage
 */
export function clearAllStorage() {
  Object.values(STORAGE_KEYS).forEach(key => removeStorage(key));
}

/**
 * Get current pact share code
 * @returns {string|null}
 */
export function getShareCode() {
  return getStorage(STORAGE_KEYS.SHARE_CODE);
}

/**
 * Set pact share code
 * @param {string} code
 */
export function setShareCode(code) {
  setStorage(STORAGE_KEYS.SHARE_CODE, code.toUpperCase());
}

/**
 * Get current member ID
 * @returns {string|null}
 */
export function getMemberId() {
  return getStorage(STORAGE_KEYS.MEMBER_ID);
}

/**
 * Set member ID
 * @param {string} id
 */
export function setMemberId(id) {
  setStorage(STORAGE_KEYS.MEMBER_ID, id);
}

/**
 * Get member name
 * @returns {string|null}
 */
export function getMemberName() {
  return getStorage(STORAGE_KEYS.MEMBER_NAME);
}

/**
 * Set member name
 * @param {string} name
 */
export function setMemberName(name) {
  setStorage(STORAGE_KEYS.MEMBER_NAME, name);
}

/**
 * Get pact name
 * @returns {string|null}
 */
export function getPactName() {
  return getStorage(STORAGE_KEYS.PACT_NAME);
}

/**
 * Set pact name
 * @param {string} name
 */
export function setPactName(name) {
  setStorage(STORAGE_KEYS.PACT_NAME, name);
}

/**
 * Get pact emoji
 * @returns {string|null}
 */
export function getPactEmoji() {
  return getStorage(STORAGE_KEYS.PACT_EMOJI);
}

/**
 * Set pact emoji
 * @param {string} emoji
 */
export function setPactEmoji(emoji) {
  setStorage(STORAGE_KEYS.PACT_EMOJI, emoji);
}

/**
 * Get locally stored habits
 * @returns {Array}
 */
export function getHabits() {
  return getStorage(STORAGE_KEYS.HABITS, []);
}

/**
 * Set habits locally
 * @param {Array} habits
 */
export function setHabits(habits) {
  setStorage(STORAGE_KEYS.HABITS, habits);
}

/**
 * Get check-in queue (pending sync items)
 * @returns {Array}
 */
export function getCheckinQueue() {
  return getStorage(STORAGE_KEYS.CHECKIN_QUEUE, []);
}

/**
 * Add check-in to queue for background sync
 * @param {Object} checkin - { shareCode, memberId, habitId, date }
 */
export function queueCheckin(checkin) {
  const queue = getCheckinQueue();
  // Avoid duplicates
  const exists = queue.some(q =>
    q.shareCode === checkin.shareCode &&
    q.habitId === checkin.habitId &&
    q.date === checkin.date &&
    q.memberId === checkin.memberId
  );
  if (!exists) {
    queue.push({ ...checkin, queuedAt: Date.now() });
    setStorage(STORAGE_KEYS.CHECKIN_QUEUE, queue);
  }
}

/**
 * Remove check-in from queue after successful sync
 * @param {Object} checkin
 */
export function dequeueCheckin(checkin) {
  const queue = getCheckinQueue().filter(q =>
    !(q.shareCode === checkin.shareCode &&
      q.habitId === checkin.habitId &&
      q.date === checkin.date &&
      q.memberId === checkin.memberId)
  );
  setStorage(STORAGE_KEYS.CHECKIN_QUEUE, queue);
}

/**
 * Get full pact data from localStorage
 * @returns {Object|null}
 */
export function getFullPactData() {
  return getStorage(STORAGE_KEYS.PACT_DATA);
}

/**
 * Save full pact data to localStorage
 * @param {Object} data
 */
export function setFullPactData(data) {
  setStorage(STORAGE_KEYS.PACT_DATA, data);
  setStorage(STORAGE_KEYS.LAST_SYNC, Date.now());
}

/**
 * Get last successful sync timestamp
 * @returns {number}
 */
export function getLastSync() {
  return getStorage(STORAGE_KEYS.LAST_SYNC, 0);
}

/**
 * Sync queued check-ins to API
 * @returns {Promise<{synced: number, failed: number}>}
 */
export async function syncCheckinQueue() {
  const queue = getCheckinQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const apiBase = getApiBase();
  let synced = 0;
  let failed = 0;

  for (const checkin of queue) {
    try {
      const response = await fetch(`${apiBase}/api/pacts/${checkin.shareCode}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: checkin.memberId,
          habitId: checkin.habitId,
          date: checkin.date
        })
      });

      if (response.ok) {
        dequeueCheckin(checkin);
        synced++;
      } else {
        failed++;
        console.warn('Check-in sync failed:', await response.text());
      }
    } catch (e) {
      failed++;
      console.error('Check-in sync error:', e);
    }
  }

  return { synced, failed };
}

/**
 * Fetch full pact state from API and update localStorage
 * @param {string} shareCode
 * @returns {Promise<Object|null>}
 */
export async function fetchAndCachePact(shareCode) {
  const apiBase = getApiBase();
  try {
    const response = await fetch(`${apiBase}/api/pacts/${shareCode}/state`);
    if (response.ok) {
      const data = await response.json();
      setFullPactData(data);
      setHabits(data.habits || []);
      return data;
    }
  } catch (e) {
    console.error('Fetch pact failed:', e);
  }
  return null;
}

/**
 * Check if we're online
 * @returns {boolean}
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Setup online/offline listeners for auto-sync
 * @param {Function} onOnline - Callback when coming online
 */
export function setupNetworkListeners(onOnline) {
  window.addEventListener('online', () => {
    console.log('Network: online');
    if (onOnline) onOnline();
  });
  window.addEventListener('offline', () => {
    console.log('Network: offline');
  });
}

export { STORAGE_KEYS };