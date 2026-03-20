// [claude-code 2026-03-10] Animated text — useAnimatedText hook with framer-motion
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

/* ─── Hook: useAnimatedText ─── */
export function useAnimatedText(text: string, speed = 30) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    if (!text) return;

    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(iv);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(iv);
  }, [text, speed]);

  return { displayed, done };
}

/* ─── Component: AnimatedText ─── */
interface AnimatedTextProps {
  text: string;
  speed?: number;
  className?: string;
  as?: 'span' | 'p' | 'div';
}

export function AnimatedText({ text, speed = 30, className, as: Tag = 'span' }: AnimatedTextProps) {
  const { displayed } = useAnimatedText(text, speed);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={text}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <Tag className={cn(className)}>{displayed}</Tag>
      </motion.span>
    </AnimatePresence>
  );
}
