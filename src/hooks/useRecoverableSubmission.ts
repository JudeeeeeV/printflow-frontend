import { useCallback, useEffect, useRef, useState } from 'react';
import { invalidateApiCache } from '../services/apiClient';
import {
  SubmissionController,
  type SubmissionConfig,
  type SubmissionSnapshot,
} from '../services/submissionController';

const IDLE: SubmissionSnapshot = {
  phase: 'idle',
  isBusy: false,
  hasUnresolved: false,
  needsFile: false,
  duplicateOrderId: null,
  storageAvailable: true,
};

export function useRecoverableSubmission<T, A extends string, F extends Record<string, unknown>>(
  config: SubmissionConfig<T, A, F> & { restore: (fields: F) => void },
) {
  const [snapshot, setSnapshot] = useState<SubmissionSnapshot>(IDLE);
  const [ready, setReady] = useState(false);
  const configRef = useRef(config);
  const controllerRef = useRef<SubmissionController<T, A, F> | null>(null);
  const { scope } = config;

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const controller = new SubmissionController<T, A, F>(
      {
        scope,
        send: (args) => configRef.current.send(args),
        checkOperation: (key) => configRef.current.checkOperation(key),
        onSuccess: (result, action, fields) => {
          invalidateApiCache();
          configRef.current.onSuccess(result, action, fields);
        },
        onFailure: (error, action, fields) => configRef.current.onFailure(error, action, fields),
      },
      setSnapshot,
    );
    controllerRef.current = controller;
    const restored = controller.restore();
    if (restored) configRef.current.restore(restored);
    setSnapshot(controller.snapshot);
    setReady(true);
    const onOnline = () => controller.onReconnect();
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      controller.dispose();
      controllerRef.current = null;
    };
  }, [scope]);

  const submit = useCallback((action: A, fields: F, file: File | null) => controllerRef.current?.submit(action, fields, file), []);
  const retry = useCallback((file: File | null) => controllerRef.current?.retry(file), []);
  const check = useCallback(() => controllerRef.current?.check(), []);
  const startOver = useCallback(() => controllerRef.current?.startOver(), []);
  const submitAnyway = useCallback(() => controllerRef.current?.submitAnyway(), []);
  const dismissDuplicate = useCallback(() => controllerRef.current?.dismissDuplicate(), []);
  const saveFields = useCallback((fields: F) => controllerRef.current?.saveFields(fields), []);

  return { ...snapshot, ready, submit, retry, check, startOver, submitAnyway, dismissDuplicate, saveFields };
}
