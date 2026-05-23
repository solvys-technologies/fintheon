import { useState, useCallback } from "react";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

const STORAGE_KEY = "fintheon:todo-list";

const SEED_TODO: TodoItem = {
  id: "todo_seed_pmdb_review",
  text: "Review PMDB Monday — Kevin Warsh FOMC chair gap risk",
  done: false,
  createdAt: Date.now(),
};

function readSaved(): TodoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TodoItem[];
    persist([SEED_TODO]);
    return [SEED_TODO];
  } catch {
    return [SEED_TODO];
  }
}

function persist(items: TodoItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export function useTodoList() {
  const [todos, setTodos] = useState<TodoItem[]>(readSaved);

  const addTodo = useCallback((text: string) => {
    setTodos((prev) => {
      const next = [
        ...prev,
        { id: `todo_${Date.now()}`, text, done: false, createdAt: Date.now() },
      ];
      persist(next);
      return next;
    });
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      persist(next);
      return next;
    });
  }, []);

  const removeTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const next = prev.filter((t) => t.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const clearDone = useCallback(() => {
    setTodos((prev) => {
      const next = prev.filter((t) => !t.done);
      persist(next);
      return next;
    });
  }, []);

  return { todos, addTodo, toggleTodo, removeTodo, clearDone };
}
