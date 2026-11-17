import { useEffect, useRef } from 'react';

const SCROLLABLE = new Set(['auto', 'scroll']);

const scrollBoxOf = (element: HTMLElement): HTMLElement | null => {
  for (let node: HTMLElement | null = element; node && node !== document.body;) {
    if (SCROLLABLE.has(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight)
      return node;
    node = node.parentElement;
  }
  return null;
};

export const useScrollToLatest = <T extends HTMLElement>(latestKey: unknown) => {
  const listRef = useRef<T>(null);
  const opened = useRef(false);
  useEffect(() => {
    const behavior = opened.current ? 'smooth' : 'auto';
    opened.current = true;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const box = list && scrollBoxOf(list);
      box?.scrollTo({ top: box.scrollHeight, behavior });
    });
    return () => cancelAnimationFrame(frame);
  }, [latestKey]);
  return listRef;
};
