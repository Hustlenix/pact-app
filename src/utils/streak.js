/**
 * Streak calculation utilities for PACT
 * Calculates current and longest streaks from check-in data
 */

import { getTodayString, parseDateString } from './date.js';

/**
 * Calculate current streak for a habit/member
 * Counts consecutive days backwards from today where check-in exists
 * @param {Object} checkins - Object keyed by date string, each containing array of memberIds
 * @param {string} habitId
 * @param {string} memberId
 * @returns {number} Current streak count
 */
export function calculateCurrentStreak(checkins, habitId, memberId) {
  if (!checkins || typeof checkins !== 'object') return 0;

  let streak = 0;
  let currentDate = new Date();
  const todayStr = getTodayString();

  // Check today first
  const todayCheckins = checkins[todayStr]?.[habitId] || [];
  if (todayCheckins.includes(memberId)) {
    streak = 1;
    currentDate.setDate(currentDate.getDate() - 1);
  } else {
    // If today not checked in, streak is 0 (but we still check yesterday for "current" streak)
    // Actually, current streak means consecutive days UP TO today
    // If today not done, streak is 0
    return 0;
  }

  // Check consecutive previous days
  while (true) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayCheckins = checkins[dateStr]?.[habitId] || [];

    if (dayCheckins.includes(memberId)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculate longest streak ever achieved for a habit/member
 * @param {Object} checkins
 * @param {string} habitId
 * @param {string} memberId
 * @returns {number} Longest streak count
 */
export function calculateLongestStreak(checkins, habitId, memberId) {
  if (!checkins || typeof checkins !== 'object') return 0;

  const sortedDates = Object.keys(checkins)
    .filter(d => checkins[d][habitId]?.includes(memberId))
    .sort();

  if (sortedDates.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = parseDateString(sortedDates[i - 1]);
    const currDate = parseDateString(sortedDates[i]);
    const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

/**
 * Calculate streak for all members/habits in a pact
 * @param {Object} pact - Full pact object with members, habits, checkins
 * @returns {Object} Nested object: streaks[memberId][habitId] = { current, longest }
 */
export function calculateAllStreaks(pact) {
  const streaks = {};

  pact.members?.forEach(member => {
    streaks[member.memberId] = {};
    pact.habits?.forEach(habit => {
      const current = calculateCurrentStreak(pact.checkins, habit.habitId, member.memberId);
      const longest = calculateLongestStreak(pact.checkins, habit.habitId, member.memberId);
      streaks[member.memberId][habit.habitId] = { current, longest };
    });
  });

  return streaks;
}

/**
 * Get streak status for display
 * @param {number} current
 * @param {number} longest
 * @returns {Object} { label, variant }
 */
export function getStreakStatus(current, longest) {
  if (current === 0) {
    return { label: 'Start your streak!', variant: 'empty' };
  }
  if (current >= longest && longest > 0) {
    return { label: `🔥 ${current} day${current !== 1 ? 's' : ''} (personal best!)`, variant: 'best' };
  }
  return { label: `${current} day${current !== 1 ? 's' : ''}`, variant: 'active' };
}

/**
 * Generate chain link data for visualization
 * Returns array of link objects for last N days + today + next N days
 * @param {Object} checkins
 * @param {string} habitId
 * @param {string} memberId
 * @param {number} lookback - Days to show before today
 * @param {number} lookahead - Days to show after today
 * @returns {Array} Array of { date, status: 'done'|'missed'|'today'|'future', dayName }
 */
export function generateChainLinks(checkins, habitId, memberId, lookback = 7, lookahead = 3) {
  const links = [];
  const todayStr = getTodayString();

  // Past days (lookback days before today)
  for (let i = lookback; i >= 1; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const done = checkins[dateStr]?.[habitId]?.includes(memberId) || false;
    links.push({
      date: dateStr,
      dayName: date.toLocaleDateString(undefined, { weekday: 'short' }),
      status: done ? 'done' : 'missed',
      isToday: false
    });
  }

  // Today
  const todayDone = checkins[todayStr]?.[habitId]?.includes(memberId) || false;
  links.push({
    date: todayStr,
    dayName: 'Today',
    status: todayDone ? 'done' : 'today',
    isToday: true
  });

  // Future days
  for (let i = 1; i <= lookahead; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    links.push({
      date: dateStr,
      dayName: date.toLocaleDateString(undefined, { weekday: 'short' }),
      status: 'future',
      isToday: false
    });
  }

  return links;
}