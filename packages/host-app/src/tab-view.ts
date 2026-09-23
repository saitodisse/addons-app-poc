import type { AddonTabAction, AddonTabField, AddonTabResult } from '@addons-poc/protocol';

/**
 * Rendered view of a tab response.
 *
 * The field lives in `packages/protocol/src/domain/tab.ts` and reaches consumers
 * on the next publication of `@addons-poc/protocol`. Until then the host
 * narrows the validated response here, so the runtime keeps validating tab
 * responses with the published package. Delete this declaration when the
 * package is republished with `AddonTabView`.
 */
export type TabResponseView = { kind: 'text' } | { kind: 'html'; html: string };

export interface TabResponse extends AddonTabResult {
  view?: TabResponseView;
}

/**
 * HTML published by the add-on, when there is one.
 *
 * The content is inserted without sanitizing: an in-process add-on already runs
 * in the host page, so rendering its view adds no new privilege. The host does
 * not interpret the markup, which keeps it free of add-on rules.
 */
export function renderedHtml(response: AddonTabResult | TabResponse | null | undefined): string | undefined {
  const view = (response as TabResponse | null | undefined)?.view;
  if (!view || view.kind !== 'html') return undefined;
  return typeof view.html === 'string' && view.html.trim() ? view.html : undefined;
}
/** Field or action that declares the heading it belongs to. */
interface Grouped {
  group?: unknown;
}

export interface ControlSection<TAction> {
  /** Heading, or `null` for the controls that declare no group. */
  title: string | null;
  fields: AddonTabField[];
  actions: TAction[];
}

/** Heading declared by one control, or `null` when it declares none. */
export function controlGroup(control: Grouped): string | null {
  const group = control.group;
  return typeof group === 'string' && group.trim() ? group.trim() : null;
}

/**
 * Builds the sections of the control panel.
 *
 * A section holds the fields and the actions that share a heading, in the order
 * the add-on declared them, with the fields first because they are the input of
 * the buttons beside them. Add-ons that declare no group keep one unlabelled
 * section, so the panel works for every add-on.
 */
export function groupPanel<TAction extends object>(
  fields: readonly AddonTabField[],
  actions: readonly TAction[],
): Array<ControlSection<TAction>> {
  const sections: Array<ControlSection<TAction>> = [];
  const sectionFor = (title: string | null): ControlSection<TAction> => {
    const existing = sections.find((candidate) => candidate.title === title);
    if (existing) return existing;
    const created: ControlSection<TAction> = { title, fields: [], actions: [] };
    sections.push(created);
    return created;
  };

  for (const field of fields) sectionFor(controlGroup(field)).fields.push(field);
  for (const action of actions) sectionFor(controlGroup(action)).actions.push(action);
  return sections;
}

/** Field or action that declares whether it chooses the content to read. */
interface Sourced {
  source?: unknown;
}

/**
 * Drops the controls that choose the content.
 *
 * The add-on marks them with `source`, and a page that already holds the
 * content hides them: the chart was chosen on the way in, so offering the
 * catalogue field again would only let the person leave what they are reading.
 * A section that loses every control disappears with them.
 */
export function readingSections<TAction extends object>(
  sections: ReadonlyArray<ControlSection<TAction>>,
): Array<ControlSection<TAction>> {
  const keeps = <T extends object>(item: T) => !(item as Sourced).source;
  return sections
    .map((section) => ({
      title: section.title,
      fields: section.fields.filter(keeps),
      actions: section.actions.filter(keeps),
    }))
    .filter((section) => section.fields.length > 0 || section.actions.length > 0);
}

/**
 * Merges the values an action returned into the current controls.
 *
 * The same object comes back when nothing changed, so the caller can keep React
 * state stable and a live action cannot loop through its own response.
 */
export function applyResponseValues(
  current: Record<string, string>,
  response: AddonTabResult | TabResponse | null | undefined,
): Record<string, string> {
  const returned = (response as { values?: unknown } | null | undefined)?.values;
  if (!returned || typeof returned !== 'object' || Array.isArray(returned)) return current;

  let changed = false;
  const merged: Record<string, string> = { ...current };
  for (const [key, value] of Object.entries(returned as Record<string, unknown>)) {
    if (typeof value !== 'string' || merged[key] === value) continue;
    merged[key] = value;
    changed = true;
  }
  return changed ? merged : current;
}

/**
 * Merges the values restored from storage into the values the page already has.
 *
 * The add-on is the authority on what it is rendering: whatever it reported
 * stays, and storage only fills the controls it has not reported yet. Replacing
 * instead of merging would let a late — or empty — record wipe the panel of a
 * page that is already rendered.
 */
export function restoredValues(
  stored: Record<string, string> | undefined,
  current: Record<string, string>,
): Record<string, string> {
  return { ...(stored ?? {}), ...current };
}

/** Action that must run again when a field it receives changes. */
export function liveAction<TAction extends object>(
  actions: readonly TAction[],
  fieldId: string,
): TAction | undefined {
  return actions.find((action) => {
    const candidate = action as { live?: unknown; receives?: string[] };
    return Boolean(candidate.live) && (candidate.receives ?? []).includes(fieldId);
  });
}

/** First action declared as live, which follows every field it receives. */
export function firstLiveAction<TAction extends object>(actions: readonly TAction[]): TAction | undefined {
  return actions.find((action) => Boolean((action as { live?: unknown }).live));
}

/** Fields a live action follows: the tab declaration, or the contract one. */
export function followedFields(
  action: { receives?: string[] } | undefined,
  contractAction?: { receives?: string[] },
): string[] {
  const declared = action?.receives ?? contractAction?.receives ?? [];
  return Array.isArray(declared) ? declared : [];
}

/** What the controls of a live action ask for on this render. */
export type LiveRunDecision = 'record' | 'now' | 'queue' | 'skip';

/** Shortest interval between two runs of a live action while a control moves. */
export const LIVE_PAUSE_MS = 60;

/**
 * Decides whether a live action runs now, waits its turn, or does nothing.
 *
 * `rendered` is the signature of the values the last run used, `latest` the
 * signature of the values on the screen right now, and `pending` says whether a
 * run is already waiting. `sinceLastRunMs` is the time since the previous run,
 * or `Infinity` when nothing has run yet.
 *
 * The answers:
 *
 * - `record` on the first render, which only notes where the controls started;
 * - `skip` when nothing changed, or when a run is already waiting — that run
 *   reads the newest values anyway, so restarting the wait would freeze the
 *   response for as long as the person keeps dragging;
 * - `now` when the controls have been still for at least one pause. A single
 *   adjustment therefore reaches the add-on immediately instead of waiting for a
 *   drag that will not come;
 * - `queue` in the middle of a drag, to run after the rest of the pause.
 */
export function liveRunDecision(state: {
  rendered: string | null;
  latest: string | null;
  pending: boolean;
  sinceLastRunMs?: number;
  pauseMs?: number;
}): LiveRunDecision {
  if (state.rendered === null) return 'record';
  if (state.rendered === state.latest) return 'skip';
  if (state.pending) return 'skip';
  const pause = state.pauseMs ?? LIVE_PAUSE_MS;
  return (state.sinceLastRunMs ?? Number.POSITIVE_INFINITY) >= pause ? 'now' : 'queue';
}

/** Time left before a queued live run may start, never negative. */
export function liveWaitMs(sinceLastRunMs: number | undefined, pauseMs = LIVE_PAUSE_MS): number {
  if (sinceLastRunMs === undefined || !Number.isFinite(sinceLastRunMs)) return 0;
  return Math.max(0, pauseMs - sinceLastRunMs);
}

/** Signature of the values a live action follows, used to skip repeated runs. */
export function liveSignature(fields: readonly string[], values: Record<string, string>): string {
  return fields.map((id) => values[id] ?? '').join('\u0000');
}
