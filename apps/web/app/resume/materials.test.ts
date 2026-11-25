import { deepEqual, equal } from 'node:assert/strict';
import { test } from 'node:test';
import { formatSections, makeMaterials, redactContacts } from './materials';

test('preview and prompt share the same evidence ids and omit common contact details', () => {
  const evidence = makeMaterials('建立即時圖表\r\n\r\n\n聯絡 dev@example.org', 'GitHub 作品');
  deepEqual(evidence, [
    { id: 'E1', text: '建立即時圖表' },
    { id: 'E2', text: '聯絡 〔電子郵件已省略〕' },
    { id: 'E3', text: 'GitHub 作品' },
  ]);
  equal(redactContacts('0912-345-678'), '〔電話已省略〕');
});

test('exported section text is editable plain text', () => {
  equal(formatSections([{ heading: '作品', bullets: [{ text: '設計檢索介面', sources: ['E1'] }] }]), '## 作品\n- 設計檢索介面');
});
