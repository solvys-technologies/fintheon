// [claude-code 2026-03-13] Track 1: Pre-market reminder toast (6:00-9:30 AM ET, once per day)
import { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

const MESSAGES = [
  'Pre-market reminder: Check overnight gaps before your first trade.',
  'Blindspot alert: Review economic calendar events before market open.',
  'Pre-market caution: Confirm your daily loss limit before trading.',
  'Reminder: Size down on the first trade of the day.',
  'Pre-market check: Is your thesis from yesterday still valid?',
];

const STORAGE_KEY = 'fintheon:premarket-reminder-last:v1';

function isPreMarketET(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 6:00 AM = 360, 9:30 AM = 570
  return totalMinutes >= 360 && totalMinutes < 570;
}

function getTodayET(): string {
  return new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
}

export function PreMarketReminder() {
  const { addToast } = useToast();

  useEffect(() => {
    if (!isPreMarketET()) return;

    const today = getTodayET();
    const last = localStorage.getItem(STORAGE_KEY);
    if (last === today) return;

    const timer = setTimeout(() => {
      const dayIndex = new Date().getDay();
      addToast(MESSAGES[dayIndex % MESSAGES.length], 'reminder', undefined, 'pre-market-reminder', 'top-right');
      localStorage.setItem(STORAGE_KEY, today);
    }, 3000);

    return () => clearTimeout(timer);
  }, [addToast]);

  return null;
}
