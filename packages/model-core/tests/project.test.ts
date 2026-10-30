import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  createEmptyProject,
  serializeProject,
  deserializeProject,
  diffProjectFiles,
  importLegacyProject,
  deriveView,
  applyViewEdits,
  diagramMemberIds,
  removeFromDiagram,
  refineConceptualEntity,
  conceptualSources,
  logicalRealizations,
  mergeModelInto,
  parseModel,
  ALL_LOGICAL_DIAGRAM_ID,
  ALL_CONCEPTUAL_DIAGRAM_ID,
} from '../src/index.js';
import type { ModelProject } from '../src/index.js';

const docModel = (f: string) => fs.readFileSync(path.resolve(import.meta.dirname, '../../../doc/참고/model', f), 'utf-8');
const fixture = (f: string) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures', f), 'utf-8');

const legacy = () =>
  importLegacyProject({
    name: 'QVI',
    files: [
      { name: 'dbproject.yaml', content: 'target_db: POSTGRESQL\nsubtype_strategy: ROLL_DOWN\n' },
      { name: 'conceptual/model.yaml', content: docModel('qvi-conceptual-model.yaml') },
      { name: 'logical/keri-wallet.yaml', content: docModel('qvi-keri-wallet-logical.yaml') },
      { name: 'logical/identifier.yaml', content: docModel('keri-identifier-logical.yaml') },
      { name: 'logical/user.yaml', content: docModel('qvi-user-logical.yaml') },
      { name: 'standardization/dictionary.yaml', content: 'words:\n  - { logical: 이용자, physical: USR }\n' },
      { name: 'output/schema.sql', content: 'CREATE TABLE X (A INT);' },
    ],
  });

test('project: legacy import defines every entity once, one diagram per subject-area file', () => {
  const { project, report } = legacy();
  const names = project.entities.map((e) => e.name);
  assert.strictEqual(new Set(names).size, names.length, 'no duplicate logical entity definitions');
  assert.ok(report.mergedEntities > 0, 'entities duplicated across files were merged');
  assert.strictEqual(report.diagrams, 3);
  assert.strictEqual(project.config.targetDbms, 'POSTGRESQL');
  assert.strictEqual(project.config.subtypeStrategy, 'ROLL_DOWN');
  assert.ok(project.standards.dictionary.includes('USR'));
  assert.ok(project.outputs['output/legacy/schema.sql']);
  // every relationship endpoint resolves to an entity id
  const ids = new Set(project.entities.map((e) => e.id));
  project.relationships.forEach((r) => assert.ok(ids.has(r.parent) && ids.has(r.child), r.id));
  // supertype references are ids
  project.entities.filter((e) => e.supertype).forEach((e) => assert.ok(ids.has(e.supertype!), `${e.name}.supertype`));
  // conceptual entities trace to same-named logical entities
  const c = project.conceptual.entities.find((x) => project.entities.some((e) => e.name === x.name))!;
  assert.ok(c.realizes?.length, 'conceptual → logical trace link');
});

test('project: folder round-trip is lossless and canonical', () => {
  const { project } = legacy();
  const files = serializeProject(project);
  assert.ok(files['minsmodeler.yaml']);
  assert.strictEqual(Object.keys(files).filter((f) => f.startsWith('model/entities/')).length, project.entities.length);
  const back = deserializeProject(files);
  assert.deepStrictEqual(back.warnings, []);
  assert.deepStrictEqual(serializeProject(back.project), files, 'serialize(deserialize(x)) === x');
  assert.deepStrictEqual(
    back.project.entities.map((e) => e.id).sort(),
    project.entities.map((e) => e.id).sort()
  );
});

test('project: moving a shape only touches that diagram file (clean Git diffs)', () => {
  const { project } = legacy();
  const before = serializeProject(project);
  const d = project.diagrams.find((x) => !x.includeAll && x.level === 'logical')!;
  const moved: ModelProject = { ...project, diagrams: project.diagrams.map((x) => (x.id === d.id ? { ...x, positions: { ...x.positions, [x.members[0]]: { x: 10, y: 20 } } } : x)) };
  const { writes, deletes } = diffProjectFiles(before, serializeProject(moved));
  assert.deepStrictEqual(Object.keys(writes), [`diagrams/${d.id}.yaml`]);
  assert.deepStrictEqual(deletes, []);
});

test('project: renaming an entity in one view keeps it linked everywhere', () => {
  const { project } = legacy();
  const all = project.diagrams.find((d) => d.id === ALL_LOGICAL_DIAGRAM_ID)!;
  const view = deriveView(project, all);
  const rel = project.relationships[0];
  const parent = project.entities.find((e) => e.id === rel.parent)!;
  const after = {
    ...view,
    entities: view.entities.map((e) => (e.id === parent.id ? { ...e, name: `${e.name}_변경` } : e)),
    // the editor renames references too, but even stale names must resolve through the id
  };
  const next = applyViewEdits(project, all, view, after);
  assert.strictEqual(next.entities.length, project.entities.length);
  assert.strictEqual(next.entities.find((e) => e.id === parent.id)!.name, `${parent.name}_변경`);
  assert.strictEqual(next.relationships.find((r) => r.id === rel.id)!.parent, parent.id);
  // other diagrams that show the entity now show the new name
  next.diagrams.filter((d) => d.level === 'logical' && diagramMemberIds(next, d).has(parent.id)).forEach((d) => {
    assert.ok(deriveView(next, d).entities.some((e) => e.name === `${parent.name}_변경`));
  });
});

test('project: adding in a subject-area view adds to model + that diagram; deleting removes everywhere', () => {
  const { project } = legacy();
  const d = project.diagrams.find((x) => !x.includeAll && x.level === 'logical')!;
  const view = deriveView(project, d);
  const added = applyViewEdits(project, d, view, {
    ...view,
    entities: [...view.entities, { name: '신규엔터티', type: 'entity', identifier: [], attributes: [] }],
  });
  const created = added.entities.find((e) => e.name === '신규엔터티')!;
  assert.ok(created.id);
  assert.ok(added.diagrams.find((x) => x.id === d.id)!.members.includes(created.id));

  const view2 = deriveView(added, d);
  const victim = view2.entities.find((e) => e.name !== '신규엔터티' && !e.supertype)!;
  const deleted = applyViewEdits(added, d, view2, { ...view2, entities: view2.entities.filter((e) => e.id !== victim.id) });
  assert.ok(!deleted.entities.some((e) => e.id === victim.id));
  assert.ok(!deleted.relationships.some((r) => r.parent === victim.id || r.child === victim.id));
  assert.ok(deleted.diagrams.every((x) => !x.members.includes(victim.id)));

  // removing from a diagram keeps the entity in the model
  const hidden = removeFromDiagram(added, d.id, [created.id]);
  assert.ok(hidden.entities.some((e) => e.id === created.id));
  assert.ok(!diagramMemberIds(hidden, hidden.diagrams.find((x) => x.id === d.id)!).has(created.id));
});

test('project: subtypes of a diagram member are shown with their supertype', () => {
  let project = createEmptyProject({ name: 't' });
  project = mergeModelInto(project, parseModel(fixture('community-da.yaml')), 'logical').project;
  const member = project.entities.find((e) => e.name === '회원')!;
  project = { ...project, diagrams: [...project.diagrams, { id: 'd1', name: '회원', level: 'logical', members: [member.id], positions: {} }] };
  const view = deriveView(project, project.diagrams.find((d) => d.id === 'd1')!);
  assert.deepStrictEqual(view.entities.map((e) => e.name).sort(), ['개인', '단체', '회원'].sort());
  assert.strictEqual(view.entities.find((e) => e.name === '개인')!.supertype, '회원');
});

test('project: refine creates a traced logical entity; trace works both ways', () => {
  let project = createEmptyProject({ name: 't' });
  project = mergeModelInto(project, parseModel(docModel('qvi-conceptual-model.yaml')), 'conceptual').project;
  const c = project.conceptual.entities[0];
  const res = refineConceptualEntity(project, c.id);
  assert.ok(res.logicalId);
  assert.deepStrictEqual(logicalRealizations(res.project, c.id).map((e) => e.id), [res.logicalId]);
  assert.deepStrictEqual(conceptualSources(res.project, res.logicalId!).map((x) => x.id), [c.id]);
  // refining again reuses the same logical entity
  const again = refineConceptualEntity(res.project, c.id);
  assert.strictEqual(again.logicalId, res.logicalId);
  assert.strictEqual(again.project.entities.length, res.project.entities.length);
  // conceptual view edits keep the trace
  const cd = again.project.diagrams.find((d) => d.id === ALL_CONCEPTUAL_DIAGRAM_ID)!;
  const v = deriveView(again.project, cd);
  const edited = applyViewEdits(again.project, cd, v, { ...v, entities: v.entities.map((e) => (e.id === c.id ? { ...e, purpose: '설명' } : e)) });
  assert.deepStrictEqual(edited.conceptual.entities.find((e) => e.id === c.id)!.realizes, [res.logicalId]);
});
