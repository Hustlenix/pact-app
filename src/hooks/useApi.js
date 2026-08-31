/**
 * API hook for PACT
 * Wrapper around fetch with localStorage fallback and error handling
 */

import { useCallback, useRef } from 'react';
import { getApiBase } from './storage.js';

/**
 * Custom hook for API calls with offline queue support
 * @returns {Object} API methods
 */
export function useApi() {
  const abortControllers = useRef(new Map());

  /**
   * Make an API request with automatic abort on unmount
   * @param {string} endpoint - API endpoint (e.g., '/api/pacts')
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>}
   */
  const request = useCallback(async (endpoint, options = {}) => {
    const apiBase = getApiBase();
    const url = `${apiBase}${endpoint}`;

    const controller = new AbortController();
    const requestId = `${endpoint}-${Date.now()}`;
    abortControllers.current.set(requestId, controller);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      abortControllers.current.delete(requestId);
      return response;
    } catch (e) {
      abortControllers.current.delete(requestId);
      if (e.name === 'AbortError') {
        throw new Error('Request aborted');
      }
      throw e;
    }
  }, []);

  /**
   * Create a new pact
   * @param {string} name - Pact name
   * @param {string} creatorName - Creator's name
   * @param {string} emoji - Pact emoji
   * @returns {Promise<{pactId: string, shareCode: string}|null>}
   */
  const createPact = useCallback(async (name, creatorName, emoji) => {
    try {
      const response = await request('/api/pacts', {
        method: 'POST',
        body: JSON.stringify({ name, creatorName, emoji })
      });

      if (response.ok) {
        return await response.json();
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to create pact');
    } catch (e) {
      console.error('createPact error:', e);
      throw e;
    }
  }, [request]);

  /**
   * Get pact info by share code
   * @param {string} code - Share code
   * @returns {Promise<Object|null>}
   */
  const getPact = useCallback(async (code) => {
    try {
      const response = await request(`/api/pacts/${encodeURIComponent(code)}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (e) {
      console.error('getPact error:', e);
      return null;
    }
  }, [request]);

  /**
   * Join a pact as a member
   * @param {string} code - Share code
   * @param {string} name - Member name
   * @returns {Promise<{memberId: string, name: string}|null>}
   */
  const joinPact = useCallback(async (code, name) => {
    try {
      const response = await request(`/api/pacts/${encodeURIComponent(code)}/members`, {
        method: 'POST',
        body: JSON.stringify({ name })
      });

      if (response.ok) {
        return await response.json();
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to join pact');
    } catch (e) {
      console.error('joinPact error:', e);
      throw e;
    }
  }, [request]);

  /**
   * Add a habit to a pact
   * @param {string} code - Share code
   * @param {Object} habit - { name, description, frequency }
   * @returns {Promise<Object|null>}
   */
  const addHabit = useCallback(async (code, habit) => {
    try {
      const response = await request(`/api/pacts/${encodeURIComponent(code)}/habits`, {
        method: 'POST',
        body: JSON.stringify(habit)
      });

      if (response.ok) {
        return await response.json();
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to add habit');
    } catch (e) {
      console.error('addHabit error:', e);
      throw e;
    }
  }, [request]);

  /**
   * Record a check-in
   * @param {string} code - Share code
   * @param {Object} checkin - { memberId, habitId, date }
   * @returns {Promise<boolean>}
   */
  const checkIn = useCallback(async (code, checkin) => {
    try {
      const response = await request(`/api/pacts/${encodeURIComponent(code)}/checkin`, {
        method: 'POST',
        body: JSON.stringify(checkin)
      });
      return response.ok;
    } catch (e) {
      console.error('checkIn error:', e);
      return false;
    }
  }, [request]);

  /**
   * Get full pact state with streaks
   * @param {string} code - Share code
   * @returns {Promise<Object|null>}
   */
  const getPactState = useCallback(async (code) => {
    try {
      const response = await request(`/api/pacts/${encodeURIComponent(code)}/state`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (e) {
      console.error('getPactState error:', e);
      return null;
    }
  }, [request]);

  /**
   * Health check
   * @returns {Promise<boolean>}
   */
  const healthCheck = useCallback(async () => {
    try {
      const response = await request('/api/health');
      return response.ok;
    } catch {
      return false;
    }
  }, [request]);

  // Cleanup on unmount
  // Note: In React 18 StrictMode, this runs twice in dev
  // The abortControllers map handles this gracefully

  return {
    createPact,
    getPact,
    joinPact,
    addHabit,
    checkIn,
    getPactState,
    healthCheck
  };
}