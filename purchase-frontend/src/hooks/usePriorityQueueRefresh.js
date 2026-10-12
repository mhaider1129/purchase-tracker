import { useEffect, useRef } from 'react';

// Refresh read views without discarding an order/assessment currently being edited.
export default function usePriorityQueueRefresh(refresh, paused = false) {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; }, [refresh]);
  useEffect(() => {
    if (paused) return undefined;
    const run = () => { if (document.visibilityState !== 'hidden') latest.current(); };
    const timer = window.setInterval(run, 30000);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [paused]);
}
