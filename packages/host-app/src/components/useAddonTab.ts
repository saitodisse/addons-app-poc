import { useCallback, useEffect, useRef, useState } from 'react';
import { validateTabActionInput, validateTabResult } from '@addons-poc/protocol';
import type { AddonInstance, AddonTabAction, AddonTabResult } from '@addons-poc/protocol';
import { applyResponseValues, firstLiveAction, followedFields, groupPanel, LIVE_PAUSE_MS, liveRunDecision, liveSignature, liveWaitMs, restoredValues, type ControlSection } from '../tab-view';

/**
 * Pause before the tab state reaches storage.
 *
 * A dragged slider produces a value for every pixel, and each value would
 * otherwise be serialized — response and rendered view included — and written
 * to the store.
 */
const SAVE_DELAY_MS = 400;

export interface AddonTabController {
  values: Record<string, string>;
  setValue: (id: string, value: string) => void;
  response: AddonTabResult | null;
  runningAction: string | null;
  run: (actionId: string) => Promise<void>;
  sections: Array<ControlSection<AddonTabAction>>;
  /** True while a storage provider restores or saves the tab. */
  ready: boolean;
}

export interface AddonTabOptions {
  /** Called after every response, which is how the result page follows the controls. */
  onResponse?: (response: AddonTabResult) => void;
}

/**
 * State of an add-on interface: the control values, the response, and the runs.
 *
 * It is shared by the add-on page and by the page of a rendered result, so both
 * offer the same panel and the same behaviour.
 */
export function useAddonTab(addon: AddonInstance | null, options: AddonTabOptions = {}): AddonTabController {
  const tab = addon?.ui;
  const [values, setValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<AddonTabResult | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [ready, setReady] = useState(!tab?.persistence);
  const renderedSignatureRef = useRef<string | null>(null);
  const latestSignatureRef = useRef<string | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When the last live run started, or `undefined` when none has run yet. */
  const liveRanAtRef = useRef<number | undefined>(undefined);
  const onResponseRef = useRef(options.onResponse);
  onResponseRef.current = options.onResponse;

  const publish = useCallback((next: AddonTabResult) => {
    setResponse(next);
    setValues((current) => applyResponseValues(current, next));
    onResponseRef.current?.(next);
  }, []);

  useEffect(() => {
    if (!tab) return;
    let active = true;
    const restore = async () => {
      const saved = await tab.persistence?.load();
      if (!active) return;
      if (saved) {
        // Storage fills the controls the add-on has not reported yet. What the
        // add-on already said wins, so a late or empty record cannot wipe the
        // panel of a page that is already rendered.
        setValues((current) => restoredValues(saved.values, current));
        setResponse((current) => current ?? saved.response ?? null);
      }
      setReady(true);
    };
    void restore();
    return () => { active = false; };
  }, [tab]);

  /** State waiting for the pause, so leaving the page cannot lose it. */
  const pendingSaveRef = useRef<{ values: Record<string, string>; response?: AddonTabResult } | null>(null);

  useEffect(() => {
    if (!tab || !ready || !tab.persistence) return;
    const persistence = tab.persistence;
    const payload = { values, ...(response ? { response } : {}) };
    pendingSaveRef.current = payload;
    const timer = setTimeout(() => {
      pendingSaveRef.current = null;
      void persistence.save(payload);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, response, tab, values]);

  // Only a write that is still waiting is flushed on the way out. Flushing
  // whatever the hook holds would let an unmount — which React also performs on
  // purpose to test the effects — store an empty state over the real one.
  useEffect(() => {
    const persistence = tab?.persistence;
    if (!persistence) return;
    return () => {
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (pending) void persistence.save(pending);
    };
  }, [tab]);

  useEffect(() => {
    if (!tab) return;
    let active = true;
    const refresh = async () => {
      const snapshot = await tab.getSnapshot?.();
      if (!active || !snapshot) return;
      setResponse(snapshot);
      setValues((current) => applyResponseValues(current, snapshot));
    };
    void refresh();
    const unsubscribe = tab.subscribe?.(() => { void refresh(); });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [tab]);

  const run = useCallback(async (actionId: string) => {
    if (!addon || !tab) return;
    if (!tab.run) {
      publish({ status: 'info', body: 'This add-on does not offer interactive actions.' });
      return;
    }

    const input = validateTabActionInput(addon.manifest.contract, actionId, values);
    if (!input.valid) {
      publish({ status: 'error', body: input.errors.join('\n') });
      return;
    }

    setRunningAction(actionId);
    try {
      const result = await tab.run(actionId, input.values);
      const output = validateTabResult(result);
      if (!output.valid) {
        publish({ status: 'error', body: `Response rejected by the contract: ${output.errors.join('\n')}` });
      } else {
        publish(result);
      }
    } catch (error) {
      publish({ status: 'error', body: (error as Error).message || 'The action could not be completed.' });
    } finally {
      setRunningAction(null);
    }
  }, [addon, publish, tab, values]);

  // A queued run reads the newest values, so the pause never fires mid-drag state.
  const runRef = useRef(run);
  runRef.current = run;

  const followedAction = tab ? firstLiveAction(tab.actions ?? []) : undefined;
  const followed = followedFields(
    followedAction as { receives?: string[] } | undefined,
    addon?.manifest.contract.ui.actions.find((action) => action.id === followedAction?.id),
  );
  const followedSignature = followedAction ? liveSignature(followed, values) : null;

  useEffect(() => {
    if (!tab || !followedAction || !ready) return;
    latestSignatureRef.current = followedSignature;

    // A run in the middle of a drag keeps its place instead of restarting on
    // every change: the action runs at most once per pause and always with the
    // newest values. Restarting the pause would freeze the response for as long
    // as the person keeps dragging. A change that arrives after the controls
    // have been still runs straight away, so a single adjustment costs no wait.
    const ranAt = liveRanAtRef.current;
    const decision = liveRunDecision({
      rendered: renderedSignatureRef.current,
      latest: followedSignature,
      pending: liveTimerRef.current !== null,
      ...(ranAt === undefined ? {} : { sinceLastRunMs: performance.now() - ranAt }),
    });
    if (decision === 'record') {
      renderedSignatureRef.current = followedSignature;
      return;
    }
    if (decision === 'skip') return;

    const start = () => {
      liveTimerRef.current = null;
      liveRanAtRef.current = performance.now();
      renderedSignatureRef.current = latestSignatureRef.current;
      void runRef.current(followedAction.id);
    };
    if (decision === 'now') {
      start();
      return;
    }
    const sinceLastRun = liveRanAtRef.current === undefined ? undefined : performance.now() - liveRanAtRef.current;
    liveTimerRef.current = setTimeout(start, liveWaitMs(sinceLastRun, LIVE_PAUSE_MS));
  }, [followedAction, followedSignature, ready, tab]);

  useEffect(() => () => {
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
  }, []);

  const setValue = useCallback((id: string, value: string) => {
    setValues((current) => ({ ...current, [id]: value }));
  }, []);

  return {
    values,
    setValue,
    response,
    runningAction,
    run,
    sections: tab ? groupPanel(tab.fields ?? [], tab.actions ?? []) : [],
    ready,
  };
}
