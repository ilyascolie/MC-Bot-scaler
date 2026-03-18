'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const DocumentStore = require('../src/core/documents/store');
const Document = require('../src/core/documents/document');

describe('DocumentStore', () => {
  let store;

  beforeEach(() => {
    store = new DocumentStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  describe('createDocument', () => {
    it('should create a document and return it', () => {
      const doc = new Document({
        type: 'plan',
        scope: 'self',
        body: 'Mine iron this morning',
        created_by: 'bot-1',
      });
      const result = store.createDocument(doc);
      assert.strictEqual(result.id, doc.id);
      assert.strictEqual(result.type, 'plan');
      assert.strictEqual(result.body, 'Mine iron this morning');
    });

    it('should auto-sign the creator as first signatory', () => {
      const doc = new Document({
        type: 'plan',
        scope: 'self',
        body: 'Mine iron',
        created_by: 'bot-1',
      });
      store.createDocument(doc);
      const sigs = store.getSignatories(doc.id);
      assert.strictEqual(sigs.length, 1);
      assert.strictEqual(sigs[0], 'bot-1');
    });

    it('should accept a plain object and wrap in Document', () => {
      const result = store.createDocument({
        type: 'norm',
        scope: 'village',
        body: 'Share all iron',
        created_by: 'bot-2',
      });
      assert.ok(result.id);
      assert.strictEqual(result.type, 'norm');
    });
  });

  describe('signDocument', () => {
    it('should add a signatory to the document', () => {
      const doc = store.createDocument({
        type: 'agreement',
        scope: 'pair',
        body: 'Trade deal',
        created_by: 'bot-1',
      });
      store.signDocument(doc.id, 'bot-2', Date.now());
      const sigs = store.getSignatories(doc.id);
      assert.strictEqual(sigs.length, 2);
      assert.ok(sigs.includes('bot-1'));
      assert.ok(sigs.includes('bot-2'));
    });

    it('should remove signatory from awaiting list on sign', () => {
      const doc = store.createDocument({
        type: 'agreement',
        scope: 'pair',
        body: 'Trade deal',
        created_by: 'bot-1',
        awaiting: JSON.stringify(['bot-2', 'bot-3']),
      });
      store.signDocument(doc.id, 'bot-2', Date.now());
      const pending = store.getPendingProposals('bot-2');
      assert.strictEqual(pending.length, 0);
      const stillPending = store.getPendingProposals('bot-3');
      assert.strictEqual(stillPending.length, 1);
    });
  });

  describe('getDocumentsForBot', () => {
    it('should return documents sorted by type priority', () => {
      store.createDocument({ type: 'plan', scope: 'self', body: 'Plan A', created_by: 'bot-1' });
      store.createDocument({ type: 'institution', scope: 'village', body: 'Council', created_by: 'bot-1' });
      store.createDocument({ type: 'norm', scope: 'group', body: 'Share iron', created_by: 'bot-1' });
      store.createDocument({ type: 'agreement', scope: 'pair', body: 'Deal', created_by: 'bot-1' });
      store.createDocument({ type: 'technology', scope: 'world', body: 'Smelting', created_by: 'bot-1' });
      store.createDocument({ type: 'ability', scope: 'self', body: 'Mining', created_by: 'bot-1' });
      store.createDocument({ type: 'role', scope: 'group', body: 'Miner', created_by: 'bot-1' });

      const docs = store.getDocumentsForBot('bot-1');
      assert.strictEqual(docs.length, 7);
      assert.strictEqual(docs[0].type, 'institution');
      assert.strictEqual(docs[1].type, 'norm');
      assert.strictEqual(docs[2].type, 'role');
      assert.strictEqual(docs[3].type, 'agreement');
      assert.strictEqual(docs[4].type, 'technology');
      assert.strictEqual(docs[5].type, 'ability');
      assert.strictEqual(docs[6].type, 'plan');
    });

    it('should only return alive documents', () => {
      const doc = store.createDocument({ type: 'plan', scope: 'self', body: 'Plan A', created_by: 'bot-1' });
      store.killDocument(doc.id);
      const docs = store.getDocumentsForBot('bot-1');
      assert.strictEqual(docs.length, 0);
    });
  });

  describe('getDocumentTree', () => {
    it('should build indented text tree', () => {
      const inst = store.createDocument({ type: 'institution', scope: 'village', body: 'Village Council', created_by: 'bot-1' });
      const norm = store.createDocument({ type: 'norm', scope: 'village', body: 'All members share iron ore finds', created_by: 'bot-1', parent_id: inst.id });
      store.createDocument({ type: 'agreement', scope: 'pair', body: 'Marcus mines iron, Sera smelts it', created_by: 'bot-1', parent_id: norm.id });
      store.createDocument({ type: 'plan', scope: 'self', body: 'I will mine iron this morning', created_by: 'bot-1' });

      const tree = store.getDocumentTree('bot-1');
      const lines = tree.split('\n');
      assert.strictEqual(lines[0], '[institution] Village Council');
      assert.strictEqual(lines[1], '  [norm] All members share iron ore finds');
      assert.strictEqual(lines[2], '    [agreement] Marcus mines iron, Sera smelts it');
      assert.strictEqual(lines[3], '[plan] I will mine iron this morning');
    });

    it('should return empty string when no documents exist', () => {
      const tree = store.getDocumentTree('bot-1');
      assert.strictEqual(tree, '');
    });
  });

  describe('proposeDocument', () => {
    it('should create a document with awaiting list', () => {
      const doc = store.proposeDocument({
        type: 'agreement',
        scope: 'pair',
        body: 'Trade deal',
        created_by: 'bot-1',
        awaiting: JSON.stringify(['bot-2', 'bot-3']),
      });
      const pending2 = store.getPendingProposals('bot-2');
      assert.strictEqual(pending2.length, 1);
      assert.strictEqual(pending2[0].id, doc.id);
      const pending3 = store.getPendingProposals('bot-3');
      assert.strictEqual(pending3.length, 1);
    });
  });

  describe('challengeDocument', () => {
    it('should create a child document with challenge reason', () => {
      const parent = store.createDocument({ type: 'norm', scope: 'village', body: 'Share iron', created_by: 'bot-1' });
      const challenge = store.challengeDocument(parent.id, 'bot-2', 'Iron is too scarce to share');
      assert.strictEqual(challenge.parent_id, parent.id);
      assert.strictEqual(challenge.type, parent.type);
      assert.strictEqual(challenge.body, 'Iron is too scarce to share');
      assert.strictEqual(challenge.created_by, 'bot-2');
    });

    it('should return null for non-existent document', () => {
      const result = store.challengeDocument('nonexistent', 'bot-2', 'reason');
      assert.strictEqual(result, null);
    });
  });

  describe('killDocument', () => {
    it('should soft delete a document', () => {
      const doc = store.createDocument({ type: 'plan', scope: 'self', body: 'Plan A', created_by: 'bot-1' });
      store.killDocument(doc.id);
      const docs = store.getDocumentsForBot('bot-1');
      assert.strictEqual(docs.length, 0);
    });
  });

  describe('trust scores', () => {
    it('should return 0 for unknown trust score', () => {
      const score = store.getTrustScore('bot-1', 'bot-2');
      assert.strictEqual(score, 0);
    });

    it('should update trust score', () => {
      store.updateTrust('bot-1', 'bot-2', 10, Date.now());
      const score = store.getTrustScore('bot-1', 'bot-2');
      assert.strictEqual(score, 10);
    });

    it('should accumulate trust score deltas', () => {
      store.updateTrust('bot-1', 'bot-2', 10, Date.now());
      store.updateTrust('bot-1', 'bot-2', 15, Date.now());
      const score = store.getTrustScore('bot-1', 'bot-2');
      assert.strictEqual(score, 25);
    });

    it('should clamp trust score at 100', () => {
      store.updateTrust('bot-1', 'bot-2', 80, Date.now());
      store.updateTrust('bot-1', 'bot-2', 50, Date.now());
      const score = store.getTrustScore('bot-1', 'bot-2');
      assert.strictEqual(score, 100);
    });

    it('should clamp trust score at -100', () => {
      store.updateTrust('bot-1', 'bot-2', -80, Date.now());
      store.updateTrust('bot-1', 'bot-2', -50, Date.now());
      const score = store.getTrustScore('bot-1', 'bot-2');
      assert.strictEqual(score, -100);
    });
  });

  describe('getTrustMap', () => {
    it('should return all trust scores from a bot', () => {
      store.updateTrust('bot-1', 'bot-2', 10, Date.now());
      store.updateTrust('bot-1', 'bot-3', -5, Date.now());
      const map = store.getTrustMap('bot-1');
      assert.strictEqual(map['bot-2'], 10);
      assert.strictEqual(map['bot-3'], -5);
      assert.strictEqual(Object.keys(map).length, 2);
    });

    it('should return empty object when no trust scores exist', () => {
      const map = store.getTrustMap('bot-unknown');
      assert.deepStrictEqual(map, {});
    });
  });

  describe('getPendingProposals', () => {
    it('should return documents where bot is in awaiting', () => {
      store.createDocument({
        type: 'agreement',
        scope: 'pair',
        body: 'Deal 1',
        created_by: 'bot-1',
        awaiting: JSON.stringify(['bot-2']),
      });
      store.createDocument({
        type: 'agreement',
        scope: 'pair',
        body: 'Deal 2',
        created_by: 'bot-1',
        awaiting: JSON.stringify(['bot-3']),
      });
      const pending = store.getPendingProposals('bot-2');
      assert.strictEqual(pending.length, 1);
      assert.strictEqual(pending[0].body, 'Deal 1');
    });

    it('should not return killed documents', () => {
      const doc = store.createDocument({
        type: 'agreement',
        scope: 'pair',
        body: 'Dead deal',
        created_by: 'bot-1',
        awaiting: JSON.stringify(['bot-2']),
      });
      store.killDocument(doc.id);
      const pending = store.getPendingProposals('bot-2');
      assert.strictEqual(pending.length, 0);
    });
  });

  describe('getSignatories', () => {
    it('should return all signatory bot IDs', () => {
      const doc = store.createDocument({ type: 'plan', scope: 'self', body: 'Plan', created_by: 'bot-1' });
      store.signDocument(doc.id, 'bot-2', Date.now());
      store.signDocument(doc.id, 'bot-3', Date.now());
      const sigs = store.getSignatories(doc.id);
      assert.strictEqual(sigs.length, 3);
      assert.ok(sigs.includes('bot-1'));
      assert.ok(sigs.includes('bot-2'));
      assert.ok(sigs.includes('bot-3'));
    });
  });

  describe('removeFromAwaiting', () => {
    it('should remove a bot from the awaiting list', () => {
      const doc = store.createDocument({
        type: 'agreement',
        scope: 'pair',
        body: 'Deal',
        created_by: 'bot-1',
        awaiting: JSON.stringify(['bot-2', 'bot-3']),
      });
      store.removeFromAwaiting(doc.id, 'bot-2');
      const pending = store.getPendingProposals('bot-2');
      assert.strictEqual(pending.length, 0);
      const stillPending = store.getPendingProposals('bot-3');
      assert.strictEqual(stillPending.length, 1);
    });

    it('should handle non-existent document gracefully', () => {
      assert.doesNotThrow(() => {
        store.removeFromAwaiting('nonexistent', 'bot-1');
      });
    });
  });

  describe('close', () => {
    it('should close the database without error', () => {
      assert.doesNotThrow(() => {
        store.close();
      });
      // Re-create store so afterEach close doesn't fail
      store = new DocumentStore(':memory:');
    });
  });
});
