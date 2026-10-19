import { describe, expect, it } from 'vitest';
import { validateTabContract } from '@addons-poc/protocol';
import { createTab } from './browser.js';
import { manifest } from './manifest.js';

describe('chord catalogue browser tab', () => {
  it('matches the public runtime field and action contract', () => {
    expect(validateTabContract(manifest, createTab())).toEqual({ valid: true, errors: [] });
  });

  it('shows local archive credentials in the Settings panel', () => {
    const fields = createTab().fields
      .filter(({ id }) => id === 'certificate' || id === 'certificatePassphrase')
      .map(({ id, group }) => ({ id, group }));

    expect(fields).toEqual([
      { id: 'certificate', group: 'Settings' },
      { id: 'certificatePassphrase', group: 'Settings' },
    ]);
  });
});
