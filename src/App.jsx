import { useState, useEffect, useRef } from 'react';
import './App.css';

const STORAGE_KEY = 'pact-habits';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function App() {
  const [habits, setHabits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitColor, setNewHabitColor] = useState('#E8612D');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const formRef = useRef(null);
  const inputRef = useRef(null);

  // Load habits from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHabits(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse habits:', e);
      }
    }
  }, []);

  // Save habits to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }, [habits]);

  // Focus input when form opens
  useEffect(() => {
    if (showForm && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showForm]);

  const handleAddHabit = (e) => {
    e.preventDefault();
    const name = newHabitName.trim();
    if (!name) return;

    const habit = {
      id: generateId(),
      name,
      color: newHabitColor,
      createdAt: new Date().toISOString(),
      completions: {}
    };

    setHabits([...habits, habit]);
    setNewHabitName('');
    setNewHabitColor('#E8612D');
    setShowForm(false);
  };

  const handleToggleComplete = (habitId) => {
    const today = getTodayString();
    setHabits(habits.map(habit => {
      if (habit.id !== habitId) return habit;
      const newCompletions = { ...habit.completions };
      if (newCompletions[today]) {
        delete newCompletions[today];
      } else {
        newCompletions[today] = true;
      }
      return { ...habit, completions: newCompletions };
    }));
  };

  const handleDeleteHabit = (habitId) => {
    if (window.confirm('Delete this habit?')) {
      setHabits(habits.filter(h => h.id !== habitId));
    }
  };

  const handleStartEdit = (habit) => {
    setEditingId(habit.id);
    setEditName(habit.name);
  };

  const handleSaveEdit = (habitId) => {
    const name = editName.trim();
    if (!name) return;
    setHabits(habits.map(h => h.id === habitId ? { ...h, name } : h));
    setEditingId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const getStreak = (habit) => {
    let streak = 0;
    const today = getTodayString();
    let checkDate = new Date(today);

    // Check if completed today or yesterday to continue streak
    const completedToday = habit.completions[today];
    const yesterday = new Date(checkDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const completedYesterday = habit.completions[yesterdayStr];

    if (!completedToday && !completedYesterday) return 0;

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (habit.completions[dateStr]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const getCompletionRate = (habit) => {
    const created = new Date(habit.createdAt);
    const today = new Date();
    const daysDiff = Math.max(1, Math.ceil((today - created) / (1000 * 60 * 60 * 24)));
    const completed = Object.keys(habit.completions).length;
    return Math.round((completed / daysDiff) * 100);
  };

  const today = getTodayString();

  return (
    <div className="pact-app">
      <header className="pact-header">
        <h1>PACT</h1>
        <p className="tagline">Social accountability habit tracker</p>
      </header>

      <main className="pact-main">
        {habits.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>No habits yet</h2>
            <p>Start building your routine with your first habit</p>
            <button className="btn btn-primary fab" onClick={() => setShowForm(true)} aria-label="Add new habit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        ) : (
          <ul className="habit-list" role="list" aria-label="Your habits">
            {habits.map(habit => (
              <li key={habit.id} className="habit-item" style={{ '--habit-color': habit.color }}>
                {editingId === habit.id ? (
                  <form className="habit-edit-form" onSubmit={(e) => { e.preventDefault(); handleSaveEdit(habit.id); }}>
                    <input
                      ref={inputRef}
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="habit-edit-input"
                      autoFocus
                      aria-label="Edit habit name"
                      maxLength={50}
                    />
                    <div className="habit-edit-actions">
                      <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>Cancel</button>
                      <button type="submit" className="btn btn-primary">Save</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <label className="habit-checkbox-label">
                      <input
                        type="checkbox"
                        className="habit-checkbox"
                        checked={habit.completions[today]}
                        onChange={() => handleToggleComplete(habit.id)}
                        aria-label={`Mark ${habit.name} as ${habit.completions[today] ? 'incomplete' : 'complete'}`}
                      />
                      <span className="habit-checkbox-custom" aria-hidden="true"></span>
                      <span className="habit-name">{habit.name}</span>
                    </label>
                    <div className="habit-meta">
                      <span className="habit-streak" aria-label={`${getStreak(habit)} day streak`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        {getStreak(habit)}
                      </span>
                      <span className="habit-rate" aria-label={`${getCompletionRate(habit)}% completion rate`}>
                        {getCompletionRate(habit)}%
                      </span>
                    </div>
                    <div className="habit-actions">
                      <button
                        className="btn-icon"
                        onClick={() => handleStartEdit(habit)}
                        aria-label={`Edit ${habit.name}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDeleteHabit(habit.id)}
                        aria-label={`Delete ${habit.name}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {showForm && (
          <form className="habit-form-overlay" onSubmit={handleAddHabit} role="dialog" aria-modal="true" aria-labelledby="form-title">
            <div className="habit-form">
              <h2 id="form-title">New Habit</h2>
              <div className="form-group">
                <label htmlFor="habit-name">Habit name</label>
                <input
                  ref={inputRef}
                  id="habit-name"
                  type="text"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  placeholder="e.g., Drink water, Exercise, Read"
                  maxLength={50}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Color</label>
                <div className="color-picker" role="radiogroup" aria-label="Choose habit color">
                  {['#E8612D', '#2D9CDB', '#27AE60', '#F39C12', '#8E44AD', '#E74C3C', '#16A085', '#2C3E50'].map(color => (
                    <button
                      key={color}
                      type="button"
                      role="radio"
                      aria-checked={newHabitColor === color}
                      onClick={() => setNewHabitColor(color)}
                      className={`color-option ${newHabitColor === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      aria-label={color}
                    >
                      {newHabitColor === color && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!newHabitName.trim()}>Add Habit</button>
              </div>
            </div>
          </form>
        )}
      </main>

      {!showForm && habits.length > 0 && (
        <button
          className="fab"
          onClick={() => setShowForm(true)}
          aria-label="Add new habit"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      )}

      <footer className="pact-footer">
        <p>SYNCS HACK 2026 — Beginner Friendly Mobile Web</p>
      </footer>
    </div>
  );
}

export default App;