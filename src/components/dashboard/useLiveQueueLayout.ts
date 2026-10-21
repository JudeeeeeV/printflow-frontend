import { useLayoutEffect, useState } from 'react';
import { getLiveQueueLayout, type LiveQueueLayout } from './liveQueueLayout';

export function useLiveQueueLayout() {
  const [grid, gridRef] = useState<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<LiveQueueLayout & { queueKey: string | null }>(() => ({ ...getLiveQueueLayout(window.innerWidth, 0), queueKey: null }));

  useLayoutEffect(() => {
    if (!grid) return;
    const scroller = grid.closest<HTMLElement>('[data-shop-scroll]');
    const panel = grid.parentElement;
    const board = panel?.parentElement;
    const footer = panel?.lastElementChild;
    let frame = 0;
    const measure = () => {
      const styles = getComputedStyle(grid);
      const top = grid.getBoundingClientRect().top - (scroller?.getBoundingClientRect().top ?? 0) + (scroller?.scrollTop ?? 0);
      // Measure remaining viewport space even in page-flow mode, avoiding a
      // feedback loop where the natural card height changes the fit decision.
      const height = (scroller?.clientHeight ?? window.innerHeight) - top
        - (footer?.getBoundingClientRect().height ?? 0)
        - (board ? parseFloat(getComputedStyle(board).paddingBottom) : 0)
        - (panel ? parseFloat(getComputedStyle(panel).borderBottomWidth) : 0)
        - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
      const cardHeight = parseFloat(getComputedStyle(document.documentElement).fontSize) * 16;
      const next = { ...getLiveQueueLayout(window.innerWidth, height, cardHeight, parseFloat(styles.rowGap)), queueKey: grid.dataset.queue ?? null };
      setLayout(previous => previous.pageSize === next.pageSize && previous.rows === next.rows && previous.contained === next.contained && previous.queueKey === next.queueKey ? previous : next);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    for (const element of [grid, panel, footer, scroller]) if (element) observer.observe(element);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [grid]);

  return { layout, gridRef };
}
