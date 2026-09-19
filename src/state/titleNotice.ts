import { getLocalStorage } from './browserStorage';
import { getLatestTitleNoticeId } from '../data/titleNotices';

const TITLE_NOTICE_SEEN_STORAGE_KEY = 'one-digit-title-notice-seen-v1';

/** Loads the latest notice id seen on this device. */
export function loadLastSeenTitleNoticeId(): string | null {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(TITLE_NOTICE_SEEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Returns whether the title notice button should show NEW. */
export function hasUnreadTitleNotice(): boolean {
  const storage = getLocalStorage();
  const latestNoticeId = getLatestTitleNoticeId();
  if (!storage || !latestNoticeId) {
    return false;
  }

  try {
    return storage.getItem(TITLE_NOTICE_SEEN_STORAGE_KEY) !== latestNoticeId;
  } catch {
    return false;
  }
}

/** Marks the latest notice as seen on this device. */
export function markLatestTitleNoticeSeen(): void {
  const storage = getLocalStorage();
  const latestNoticeId = getLatestTitleNoticeId();
  if (!storage || !latestNoticeId) {
    return;
  }

  try {
    storage.setItem(TITLE_NOTICE_SEEN_STORAGE_KEY, latestNoticeId);
  } catch {
    // Nothing to do when storage is full or blocked.
  }
}
