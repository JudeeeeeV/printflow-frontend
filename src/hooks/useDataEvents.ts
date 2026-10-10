import { useEffect, useRef } from 'react';
import { dataEvents, type DataResource } from '../services/dataEvents';

export function useDataEvents(resources: DataResource[], callback: () => void) {
  const callbackRef = useRef(callback);
  const key = resources.join(',');

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(
    () => dataEvents.subscribe(resources, () => callbackRef.current()),
    // The stable resource key avoids reconnecting when callers use an inline array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
}
