import { useEffect, useState } from 'react';
import {
  getNodeOverride,
  resetNodeOverride,
  saveNodeOverride,
} from '../services/ontologyApi.js';

const emptyOverride = { added_neighbors: [], removed_neighbors: [] };

export default function NodeOverrideEditor({ node, username, onChanged }) {
  const [label, setLabel] = useState(node.label || node.id);
  const [target, setTarget] = useState('');
  const [relationshipAction, setRelationshipAction] = useState('add');
  const [override, setOverride] = useState(emptyOverride);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setMessage('');
    getNodeOverride(node.id, username)
      .then((data) => {
        if (!active) return;
        setOverride({ ...emptyOverride, ...(data.override || {}) });
        setLabel(data.override?.label || data.original?.label || node.id);
      })
      .catch((error) => {
        if (active) setMessage(error.message || 'Unable to load personal edit.');
      });
    return () => {
      active = false;
    };
  }, [node.id, username]);

  async function handleSave(event) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');

    const added = new Set(override.added_neighbors || []);
    const removed = new Set(override.removed_neighbors || []);
    const cleanTarget = target.trim();
    if (cleanTarget) {
      if (relationshipAction === 'add') {
        added.add(cleanTarget);
        removed.delete(cleanTarget);
      } else {
        removed.add(cleanTarget);
        added.delete(cleanTarget);
      }
    }

    try {
      const data = await saveNodeOverride(node.id, username, {
        label: label.trim(),
        added_neighbors: [...added],
        removed_neighbors: [...removed],
      });
      setOverride({ ...emptyOverride, ...(data.override || {}) });
      setTarget('');
      setMessage('Personal override saved.');
      await onChanged();
    } catch (error) {
      setMessage(error.message || 'Unable to save personal edit.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    setIsSaving(true);
    setMessage('');
    try {
      await resetNodeOverride(node.id, username);
      setOverride(emptyOverride);
      setLabel(node.id);
      setTarget('');
      setMessage('Restored from the original ontology.');
      await onChanged();
    } catch (error) {
      setMessage(error.message || 'Unable to reset personal edit.');
    } finally {
      setIsSaving(false);
    }
  }

  const hasOverride = Boolean(
    override.label || override.added_neighbors?.length || override.removed_neighbors?.length
  );

  return (
    <form className="override-editor" onSubmit={handleSave}>
      <div className="section-heading">Personal Edit</div>
      <label>
        <span>Display label</span>
        <input value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} />
      </label>
      <label>
        <span>Relationship target</span>
        <input
          value={target}
          placeholder="Existing node name"
          onChange={(event) => setTarget(event.target.value)}
        />
      </label>
      <label>
        <span>Relationship action</span>
        <select value={relationshipAction} onChange={(event) => setRelationshipAction(event.target.value)}>
          <option value="add">Add relationship</option>
          <option value="remove">Remove relationship</option>
        </select>
      </label>
      <div className="override-actions">
        <button className="primary-button" type="submit" disabled={isSaving || !label.trim()}>
          {isSaving ? 'Saving' : 'Save'}
        </button>
        <button className="secondary-button" type="button" disabled={isSaving || !hasOverride} onClick={handleReset}>
          Reset
        </button>
      </div>
      {message ? <p className="override-message">{message}</p> : null}
    </form>
  );
}
