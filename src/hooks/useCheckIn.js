/**
 * useCheckIn hook - Check-in logic and streak utilities
 */

import { useCallback, useMemo } from 'react';
import { getTodayString, getLastNDates } from '../utils/date.js';
import { calculateCurrentStreak, calculateLongestStreak, generateChainLinks, getStreakStatus } from '../utils/streak.js';

/**
 * Custom hook for check-in logic
 * @param {Object} pact - Full pact object
 * @param {string} memberId - Current member ID
 * @returns {Object} Check-in helpers
 */
export function useCheckIn(pact, memberId) {
  const today = getTodayString();

  /**
   * Check if a habit is checked in for a specific date by member
   * @param {string} habitId
   * @param {string} date - YYYY-MM-DD
   * @returns {boolean}
   */
  const isCheckedIn = useCallback((habitId, date = today) => {
    if (!pact?.checkins) return false;
    const checkins = pact.checkins[date]?.[habitId] || [];
    return checkins.includes(memberId);
  }, [pact?.checkins, memberId]);

  /**
   * Get current streak for a habit
   * @param {string} habitId
   * @returns {number}
   */
  const getCurrentStreak = useCallback((habitId) => {
    if (!pact?.checkins || !memberId) return 0;
    return calculateCurrentStreak(pact.checkins, habitId, memberId);
  }, [pact?.checkins, memberId]);

  /**
   * Get longest streak for a habit
   * @param {string} habitId
   * @returns {number}
   */
  const getLongestStreak = useCallback((habitId) => {
    if (!pact?.checkins || !memberId) return 0;
    return calculateLongestStreak(pact.checkins, habitId, memberId);
  }, [pact?.checkins, memberId]);

  /**
   * Get streak status object for display
   * @param {string} habitId
   * @returns {Object} { label, variant }
   */
  const getStreakInfo = useCallback((habitId) => {
    const current = getCurrentStreak(habitId);
    const longest = getLongestStreak(habitId);
    return getStreakStatus(current, longest);
  }, [getCurrentStreak, getLongestStreak]);

  /**
   * Generate chain link data for visualization
   * @param {string} habitId
   * @param {number} lookback
   * @param {number} lookahead
   * @returns {Array}
   */
  const getChainLinks = useCallback((habitId, lookback = 7, lookahead = 3) => {
    if (!pact?.checkins || !memberId) return [];
    return generateChainLinks(pact.checkins, habitId, memberId, lookback, lookahead);
  }, [pact?.checkins, memberId]);

  /**
   * Get all streaks for all habits
   * @returns {Object}
   */
  const allStreaks = useMemo(() => {
    if (!pact?.habits || !memberId) return {};
    const streaks = {};
    pact.habits.forEach(habit => {
      streaks[habit.habitId] = {
        current: getCurrentStreak(habit.habitId),
        longest: getLongestStreak(habit.habitId),
        status: getStreakInfo(habit.habitId),
        chainLinks: getChainLinks(habit.habitId)
      };
    });
    return streaks;
  }, [pact?.habits, memberId, getCurrentStreak, getLongestStreak, getStreakInfo, getChainLinks]);

  /**
   * Get today's check-in status for all habits
   * @returns {Object}
   */
  const todayStatus = useMemo(() => {
    if (!pact?.habits) return {};
    const status = {};
    pact.habits.forEach(habit => {
      status[habit.habitId] = isCheckedIn(habit.habitId, today);
    });
    return status;
  }, [pact?.habits, isCheckedIn]);

  /**
   * Get completion rate for today
   * @returns {number} 0-1
   */
  const todayCompletionRate = useMemo(() => {
    if (!pact?.habits || pact.habits.length === 0) return 0;
    const checked = Object.values(todayStatus).filter(Boolean).length;
    return checked / pact.habits.length;
  }, [pact?.habits, todayStatus]);

  return {
    isCheckedIn,
    getCurrentStreak,
    getLongestStreak,
    getStreakInfo,
    getChainLinks,
    allStreaks,
    todayStatus,
    todayCompletionRate,
    today
  };
}

/**
 * Hook for calculating overall pact statistics
 * @param {Object} pact
 * @param {string} memberId
 * @returns {Object}
 */
export function usePactStats(pact, memberId) {
  const stats = useMemo(() => {
    if (!pact?.habits || !memberId) {
      return {
        totalHabits: 0,
        activeStreaks: 0,
        totalCurrentStreak: 0,
        totalLongestStreak: 0,
        todayCompleted: 0,
        todayTotal: 0,
        completionRate: 0
      };
    }

    let activeStreaks = 0;
    let totalCurrentStreak = 0;
    let totalLongestStreak = 0;
    let todayCompleted = 0;

    pact.habits.forEach(habit => {
      const current = calculateCurrentStreak(pact.checkins, habit.habitId, memberId);
      const longest = calculateLongestStreak(pact.checkins, habit.habitId, memberId);
      const today = getTodayString();
      const checkedToday = pact.checkins[today]?.[habit.habitId]?.includes(memberId) || false;

      if (current > 0) activeStreaks++;
      totalCurrentStreak += current;
      totalLongestStreak = Math.max(totalLongestStreak, longest);
      if (checkedToday) todayCompleted++;
    });

    return {
      totalHabits: pact.habits.length,
      activeStreaks,
      totalCurrentStreak,
      totalLongestStreak,
      todayCompleted,
      todayTotal: pact.habits.length,
      completionRate: pact.habits.length > 0 ? todayCompleted / pact.habits.length : 0
    };
  }, [pact?.habits, pact?.checkins, memberId]);

  return stats;
}