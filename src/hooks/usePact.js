/**
 * usePact hook - Main state management for PACT app
 * Handles pact state, localStorage sync, and API integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from './useApi.js';
import {
  getShareCode, setShareCode, removeStorage,
  getMemberId, setMemberId,
  getMemberName, setMemberName,
  getPactName, setPactName,
  getPactEmoji, setPactEmoji,
  getHabits, setHabits,
  getFullPactData, setFullPactData,
  getLastSync, syncCheckinQueue, fetchAndCachePact,
  isOnline, setupNetworkListeners, clearAllStorage
} from '../utils/storage.js';
import { calculateAllStreaks } from '../utils/streak.js';

/**
 * Custom hook for managing pact state
 * @returns {Object} State and methods
 */
export function usePact() {
  const [view, setView] = useState('create'); // 'create' | 'join' | 'board'
  const [pact, setPact] = useState(null);
  const [member, setMember] = useState(null);
  const [habits, setHabitsState] = useState([]);
  const [streaks, setStreaks] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'offline'
  const [online, setOnline] = useState(() => isOnline());

  const api = useApi();
  const syncIntervalRef = useRef(null);
  const initializedRef = useRef(false);

  // Initialize on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Check for existing session
    const shareCode = getShareCode();
    const memberId = getMemberId();
    const memberName = getMemberName();
    const pactName = getPactName();
    const pactEmoji = getPactEmoji();
    const cachedHabits = getHabits();
    const cachedPact = getFullPactData();

    if (shareCode && memberId && memberName) {
      // Restore session
      setMember({ memberId, name: memberName });
      setHabitsState(cachedHabits);

      if (cachedPact) {
        setPact(cachedPact);
        setStreaks(calculateAllStreaks(cachedPact));
        setView('board');
      } else {
        setView('board');
        // Fetch fresh data
        refreshPactData(shareCode);
      }
    }

    // Setup network listeners
    const cleanup = setupNetworkListeners(handleOnline);
    setOnline(isOnline());

    // Start periodic sync
    startPeriodicSync();

    return () => {
      cleanup();
      stopPeriodicSync();
    };
  }, []);

  const handleOnline = useCallback(async () => {
    setOnline(true);
    await syncCheckinQueue();
    if (getShareCode()) {
      await refreshPactData(getShareCode());
    }
  }, []);

  const startPeriodicSync = useCallback(() => {
    syncIntervalRef.current = setInterval(async () => {
      if (isOnline() && getShareCode()) {
        setSyncStatus('syncing');
        await syncCheckinQueue();
        await refreshPactData(getShareCode());
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 2000);
      } else if (!isOnline()) {
        setSyncStatus('offline');
      }
    }, 30000); // Every 30 seconds
  }, []);

  const stopPeriodicSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  const refreshPactData = useCallback(async (shareCode) => {
    try {
      const data = await fetchAndCachePact(shareCode);
      if (data) {
        setPact(data);
        setHabitsState(data.habits || []);
        setStreaks(calculateAllStreaks(data));
      }
    } catch (e) {
      console.error('Refresh pact failed:', e);
    }
  }, []);

  const createPact = useCallback(async (name, creatorName, emoji) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.createPact(name, creatorName, emoji);
      if (result) {
        const { pactId, shareCode } = result;
        setShareCode(shareCode);
        setPactName(name);
        setPactEmoji(emoji);

        // Join as creator
        const memberResult = await api.joinPact(shareCode, creatorName);
        if (memberResult) {
          const { memberId, name } = memberResult;
          setMemberId(memberId);
          setMemberName(name);
          setMember({ memberId, name });

          // Fetch full state
          const pactData = await api.getPactState(shareCode);
          if (pactData) {
            setPact(pactData);
            setHabitsState(pactData.habits || []);
            setStreaks(calculateAllStreaks(pactData));
            setView('board');
          }
        }
      }
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [api]);

  const joinPact = useCallback(async (code, name) => {
    setLoading(true);
    setError(null);
    try {
      const normalizedCode = code.toUpperCase().trim();
      const pactInfo = await api.getPact(normalizedCode);
      if (!pactInfo) {
        throw new Error('Pact not found. Check the code and try again.');
      }

      const memberResult = await api.joinPact(normalizedCode, name);
      if (memberResult) {
        const { memberId, name: memberName } = memberResult;
        setShareCode(normalizedCode);
        setMemberId(memberId);
        setMemberName(memberName);
        setPactName(pactInfo.name);
        setMember({ memberId, name: memberName });

        const pactData = await api.getPactState(normalizedCode);
        if (pactData) {
          setPact(pactData);
          setHabitsState(pactData.habits || []);
          setStreaks(calculateAllStreaks(pactData));
          setView('board');
        }
      }
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [api]);

  const addHabit = useCallback(async (habitData) => {
    const shareCode = getShareCode();
    if (!shareCode || !member) return;

    setLoading(true);
    try {
      const result = await api.addHabit(shareCode, habitData);
      if (result) {
        const newHabits = [...habits, result];
        setHabitsState(newHabits);
        setHabits(newHabits);
        await refreshPactData(shareCode);
      }
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [api, member, habits]);

  const doCheckIn = useCallback(async (habitId, date) => {
    const shareCode = getShareCode();
    const memberId = getMemberId();
    if (!shareCode || !memberId) return false;

    // Optimistic update
    const previousPact = pact;
    const previousStreaks = streaks;

    try {
      // Update local streak immediately
      const newStreaks = { ...streaks };
      if (!newStreaks[memberId]) newStreaks[memberId] = {};
      newStreaks[memberId][habitId] = {
        ...newStreaks[memberId][habitId],
        current: (newStreaks[memberId][habitId]?.current || 0) + 1
      };
      setStreaks(newStreaks);

      // Queue for sync
      const checkin = { shareCode, memberId, habitId, date };
      // We'll use the queue from storage directly
      const { queueCheckin } = await import('../utils/storage.js');
      queueCheckin(checkin);

      // Try immediate sync if online
      if (isOnline()) {
        await api.checkIn(shareCode, checkin);
        await refreshPactData(shareCode);
      }

      return true;
    } catch (e) {
      // Rollback on error
      setPact(previousPact);
      setStreaks(previousStreaks);
      console.error('Check-in failed:', e);
      return false;
    }
  }, [api, pact, streaks]);

  const logout = useCallback(() => {
    clearAllStorage();
    setPact(null);
    setMember(null);
    setHabitsState([]);
    setStreaks({});
    setView('create');
  }, []);

  const shareCode = getShareCode();

  return {
    // State
    view,
    setView,
    pact,
    member,
    habits,
    streaks,
    loading,
    error,
    setError,
    syncStatus,
    online,
    shareCode,

    // Actions
    createPact,
    joinPact,
    addHabit,
    checkIn: doCheckIn,
    logout,
    refreshPactData
  };
}