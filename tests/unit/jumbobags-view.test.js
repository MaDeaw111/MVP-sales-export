import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderJumbobags } from '../../src/views/jumbobags.js';

it('hides Jumbobag write controls from non-Admin users', async () => {
  const dom = new JSDOM('<div id="app"></div>'); global.document = dom.window.document;
  const supabase = { from: () => ({ select: () => ({ order: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) }) };
  await renderJumbobags(document.querySelector('#app'), { supabase, profile: { role: 'MANAGEMENT' } });
  expect(document.body.textContent).toContain('Jumbobag weights');
  expect(document.querySelector('#jumbobag-form')).toBeNull();
});

it('shows a deactivate action to an Admin', async () => {
  const dom = new JSDOM('<div id="app"></div>'); global.document = dom.window.document;
  const supabase = { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [{ id: 'j1', weight_kg: 850, is_active: true, remark: null }], error: null }) }) }) };
  await renderJumbobags(document.querySelector('#app'), { supabase, profile: { role: 'ADMIN' } });
  expect(document.querySelector('[data-deactivate-id="j1"]')).not.toBeNull();
  expect(document.querySelector('[data-remark-id="j1"]')).not.toBeNull();
});
