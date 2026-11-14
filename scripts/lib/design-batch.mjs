import { assertValidDocument, toEditableDocument } from './design-draft.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const plain = value => value && typeof value === 'object' && !Array.isArray(value);

// Explicit targets and selectors prevent a broad style change from touching
// unrelated artwork. A patch preserves all unspecified document/layer fields.
export function validateBatch(manifest) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.jobs) || !manifest.jobs.length) throw new Error('Batch requires version: 1 and non-empty jobs.');
  const ids = new Set();
  for (const job of manifest.jobs) {
    if (!UUID.test(job.id) || ids.has(job.id)) throw new Error('Each job needs a unique design UUID.');
    ids.add(job.id);
    if (!['update', 'render'].includes(job.action)) throw new Error('Batch actions are update or render; publishing is not supported.');
    if (!Number.isSafeInteger(job.documentRevision) || job.documentRevision < 1) throw new Error(`${job.id}: documentRevision is required.`);
    if (job.action === 'render' && job.patch !== undefined) throw new Error('render must not contain a patch.');
    if (job.action === 'update') {
      if (!plain(job.patch) || !Object.keys(job.patch).length) throw new Error('update requires a patch.');
      for (const key of Object.keys(job.patch)) if (!['canvasColor', 'elements'].includes(key)) throw new Error(`Unsupported document patch: ${key}`);
      if (job.patch.elements !== undefined && !Array.isArray(job.patch.elements)) throw new Error('patch.elements must be an array.');
      for (const edit of job.patch.elements ?? []) {
        if (!plain(edit.match) || !Object.keys(edit.match).length || !plain(edit.set) || !Object.keys(edit.set).length) throw new Error('Element edits require match and set.');
        for (const key of Object.keys(edit.match)) if (!['id', 'type', 'text'].includes(key)) throw new Error(`Unsupported selector: ${key}`);
        if (!Number.isSafeInteger(edit.count) || edit.count < 1) throw new Error('Element edit count must be a positive integer.');
        for (const key of Object.keys(edit.set)) if (['id', 'type', '__proto__', 'constructor', 'prototype'].includes(key)) throw new Error(`Cannot patch ${key}.`);
      }
    }
  }
}

export function patchDocument(row, patch) {
  const doc = structuredClone(toEditableDocument(row));
  if (patch.canvasColor !== undefined) {
    doc.canvasColor = patch.canvasColor;
    doc.template.backgroundColor = patch.canvasColor;
  }
  for (const edit of patch.elements ?? []) {
    const matched = doc.elements.filter(el => Object.entries(edit.match).every(([key, value]) => el[key] === value));
    if (matched.length !== edit.count) throw new Error(`${row.id}: selector matched ${matched.length}, expected ${edit.count}.`);
    matched.forEach(el => Object.assign(el, edit.set));
  }
  assertValidDocument(doc);
  return doc;
}

// Preflight every document AND render before any write. Writes remain CAS
// guarded, because an owner can edit a design after preflight. This is not a
// transaction: report partial completion honestly and stop at the first error.
export async function executeBatch(manifest, { apply = false, read, normalize, render, update, commit, report = async () => {} }) {
  validateBatch(manifest);
  const result = { version: 1, applied: apply, phase: 'preflight', jobs: [] };
  const prepared = [];
  try {
    for (const job of manifest.jobs) {
      const row = await read(job.id);
      if (row.document_revision !== job.documentRevision) throw new Error(`${job.id}: revision conflict; expected ${job.documentRevision}, current ${row.document_revision}.`);
      let doc = job.action === 'update' ? patchDocument(row, job.patch) : toEditableDocument(row);
      doc = { ...doc, elements: await normalize(doc.elements) };
      assertValidDocument(doc);
      const rendered = await render(doc, job.id);
      if (rendered.unresolvedFonts?.length) throw new Error(`${job.id}: unresolved fonts: ${rendered.unresolvedFonts.join(', ')}`);
      prepared.push({ job, row, doc, rendered });
      result.jobs.push({ id: job.id, name: row.name, action: job.action, expectedRevision: job.documentRevision, status: 'prepared' });
    }
    result.phase = apply ? 'applying' : 'previewed';
    await report(result);
    if (!apply) return result;
    for (let i = 0; i < prepared.length; i++) {
      const { job, row, doc, rendered } = prepared[i];
      const entry = result.jobs[i];
      entry.status = 'processing';
      await report(result);
      try {
        const current = job.action === 'update' ? await update(job.id, job.documentRevision, doc) : row;
        entry.documentRevision = current.document_revision;
        entry.status = 'preview-pending';
        await report(result);
        const saved = await commit(current, rendered);
        if (!saved.committed) throw new Error(`Preview not committed: ${saved.reason ?? 'revision changed'}`);
        entry.status = 'ready';
        await report(result);
      } catch (error) {
        entry.status = 'failed';
        entry.error = error.message;
        throw error;
      }
    }
    result.phase = 'complete';
  } catch (error) {
    result.phase = 'failed';
    result.error = error.message;
  }
  await report(result);
  return result;
}
