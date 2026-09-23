import { describe, expect, it } from 'vitest';
import { applyResponseValues, firstLiveAction, followedFields, groupPanel, LIVE_PAUSE_MS, liveAction, liveRunDecision, liveSignature, liveWaitMs, readingSections, renderedHtml, restoredValues } from './tab-view';

describe('renderedHtml', () => {
  it('returns the html published by the add-on', () => {
    expect(renderedHtml({ status: 'success', body: 'text', view: { kind: 'html', html: '<p>chart</p>' } }))
      .toBe('<p>chart</p>');
  });

  it('ignores a text view and an absent view', () => {
    expect(renderedHtml({ status: 'success', body: 'text', view: { kind: 'text' } })).toBeUndefined();
    expect(renderedHtml({ status: 'success', body: 'text' })).toBeUndefined();
    expect(renderedHtml(null)).toBeUndefined();
  });

  it('ignores an empty html string', () => {
    expect(renderedHtml({ status: 'success', body: 'text', view: { kind: 'html', html: '   ' } })).toBeUndefined();
  });
});

describe('groupPanel', () => {
  const action = (id: string, group?: string, extra: Record<string, unknown> = {}) => ({ id, label: id, ...(group ? { group } : {}), ...extra });
  const field = (id: string, group?: string) => ({ id, label: id, schema: { type: 'string', description: id, classification: 'public' as const }, ...(group ? { group } : {}) });

  it('puts the fields of a section before its actions', () => {
    const sections = groupPanel(
      [field('catalog', 'Chart'), field('fontSize', 'Current chart')],
      [action('load', 'Chart'), action('apply', 'Current chart')],
    );
    expect(sections.map((section) => section.title)).toEqual(['Chart', 'Current chart']);
    expect(sections[0].fields.map((entry) => entry.id)).toEqual(['catalog']);
    expect(sections[0].actions.map((entry) => entry.id)).toEqual(['load']);
    expect(sections[1].fields.map((entry) => entry.id)).toEqual(['fontSize']);
  });

  it('joins a group declared again later', () => {
    const sections = groupPanel([field('a', 'Key')], [action('x', 'Output'), action('y', 'Key')]);
    expect(sections.map((section) => section.title)).toEqual(['Key', 'Output']);
    expect(sections[0].actions.map((entry) => entry.id)).toEqual(['y']);
  });

  it('treats an empty or missing group as the unlabelled section', () => {
    const sections = groupPanel([field('a', '  '), field('b')], [action('c')]);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBeNull();
    expect(sections[0].fields.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('accepts empty lists', () => {
    expect(groupPanel([], [])).toEqual([]);
  });
});

describe('readingSections', () => {
  const field = (id: string, source = false) => ({ id, label: id, ...(source ? { source: true } : {}) });
  const action = (id: string, group: string | undefined, source = false) => ({
    id,
    label: id,
    ...(group ? { group } : {}),
    ...(source ? { source: true } : {}),
  });

  it('drops the controls that choose the content', () => {
    const sections = groupPanel(
      [field('catalog', true), field('fontSize')],
      [action('load', undefined, true), action('apply', undefined)],
    );
    const kept = readingSections(sections);
    expect(kept.map((section) => section.title)).toEqual([null]);
    expect(kept[0].fields.map((entry) => entry.id)).toEqual(['fontSize']);
    expect(kept[0].actions.map((entry) => entry.id)).toEqual(['apply']);
  });

  it('removes a section that loses every control', () => {
    const sections = groupPanel([field('catalog', true)], [action('load', undefined, true), action('reset', 'Options')]);
    expect(readingSections(sections).map((section) => section.title)).toEqual(['Options']);
  });

  it('keeps a panel that declares no source control', () => {
    const sections = groupPanel([field('a')], [action('b', undefined)]);
    expect(readingSections(sections)).toHaveLength(1);
  });
});

describe('liveRunDecision', () => {
  it('records the starting point on the first render', () => {
    expect(liveRunDecision({ rendered: null, latest: 'a', pending: false })).toBe('record');
  });

  it('runs straight away when the controls have been still', () => {
    expect(liveRunDecision({ rendered: 'a', latest: 'b', pending: false, sinceLastRunMs: LIVE_PAUSE_MS })).toBe('now');
    expect(liveRunDecision({ rendered: 'a', latest: 'b', pending: false })).toBe('now');
  });

  it('queues a change that arrives inside the pause', () => {
    expect(liveRunDecision({ rendered: 'a', latest: 'b', pending: false, sinceLastRunMs: 5 })).toBe('queue');
  });

  it('skips a change that repeats what was rendered', () => {
    expect(liveRunDecision({ rendered: 'a', latest: 'a', pending: false, sinceLastRunMs: 500 })).toBe('skip');
  });

  it('skips while a run is already waiting, because it reads the newest values', () => {
    expect(liveRunDecision({ rendered: 'a', latest: 'b', pending: true, sinceLastRunMs: 5 })).toBe('skip');
  });

  it('lets the caller choose the pause', () => {
    expect(liveRunDecision({ rendered: 'a', latest: 'b', pending: false, sinceLastRunMs: 40, pauseMs: 30 })).toBe('now');
    expect(liveRunDecision({ rendered: 'a', latest: 'b', pending: false, sinceLastRunMs: 40, pauseMs: 60 })).toBe('queue');
  });
});

describe('liveWaitMs', () => {
  it('waits only for the rest of the pause', () => {
    expect(liveWaitMs(20, 60)).toBe(40);
  });

  it('never waits for a first run', () => {
    expect(liveWaitMs(undefined, 60)).toBe(0);
    expect(liveWaitMs(Number.POSITIVE_INFINITY, 60)).toBe(0);
  });

  it('never returns a negative wait', () => {
    expect(liveWaitMs(200, 60)).toBe(0);
  });
});

describe('applyResponseValues', () => {
  it('merges the values an action returned', () => {
    expect(applyResponseValues({ fontSize: '16' }, { status: 'success', body: '', values: { fontSize: '22' } }))
      .toEqual({ fontSize: '22' });
  });

  it('returns the same object when nothing changed', () => {
    const current = { fontSize: '16' };
    expect(applyResponseValues(current, { status: 'success', body: '', values: { fontSize: '16' } })).toBe(current);
    expect(applyResponseValues(current, { status: 'success', body: '' })).toBe(current);
    expect(applyResponseValues(current, null)).toBe(current);
    expect(applyResponseValues(current, { status: 'success', body: '', values: { fontSize: 22 } as never })).toBe(current);
    expect(applyResponseValues(current, { status: 'success', body: '', values: ['22'] as never })).toBe(current);
  });
});

describe('restoredValues', () => {
  it('fills the controls the add-on has not reported yet', () => {
    expect(restoredValues({ fontSize: '30', transposeNumber: '2' }, {})).toEqual({ fontSize: '30', transposeNumber: '2' });
  });

  it('keeps what the add-on already reported', () => {
    expect(restoredValues({ fontSize: '16' }, { fontSize: '30' })).toEqual({ fontSize: '30' });
  });

  it('survives an empty or missing record', () => {
    expect(restoredValues({}, { fontSize: '30' })).toEqual({ fontSize: '30' });
    expect(restoredValues(undefined, {})).toEqual({});
  });
});

describe('liveAction', () => {
  const actions = [
    { id: 'load', receives: ['chart'] },
    { id: 'apply', receives: ['fontSize'], live: true },
  ];

  it('finds the action that follows a field', () => {
    expect(liveAction(actions, 'fontSize')?.id).toBe('apply');
    expect(liveAction(actions, 'chart')).toBeUndefined();
    expect(liveAction([{ id: 'load', receives: ['chart'] }], 'chart')).toBeUndefined();
  });

  it('finds the first action declared as live', () => {
    expect(firstLiveAction([{ id: 'load' }, { id: 'apply', live: true }])?.id).toBe('apply');
    expect(firstLiveAction([{ id: 'load' }])).toBeUndefined();
  });

  it('signs the values the action follows', () => {
    const fields = ['fontSize', 'chordColor'];
    expect(liveSignature(fields, { fontSize: '16', chordColor: '#fff', other: 'x' })).toBe('16\u0000#fff');
    expect(liveSignature(fields, { fontSize: '16', chordColor: '#fff' })).toBe('16\u0000#fff');
    expect(liveSignature(fields, { chordColor: '#fff' })).toBe('\u0000#fff');
    expect(liveSignature([], { fontSize: '16' })).toBe('');
  });

  it('prefers the declaration of the tab and falls back to the contract', () => {
    expect(followedFields({ receives: ['a'] }, { receives: ['b'] })).toEqual(['a']);
    expect(followedFields({}, { receives: ['b'] })).toEqual(['b']);
    expect(followedFields(undefined, undefined)).toEqual([]);
  });
});