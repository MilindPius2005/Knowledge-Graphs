import { useState, useRef, useEffect, useCallback } from 'react';

export default function SkillMultiSelect({ selected = [], options = [], onChange }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const filtered = options.filter(
    (opt) =>
      !selected.includes(opt) &&
      opt.toLowerCase().includes(query.toLowerCase())
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [query, isOpen]);

  const addSkill = useCallback(
    (skill) => {
      if (!selected.includes(skill)) {
        onChange([...selected, skill]);
      }
      setQuery('');
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [selected, onChange]
  );

  const removeSkill = useCallback(
    (skill) => {
      onChange(selected.filter((s) => s !== skill));
    },
    [selected, onChange]
  );

  function handleKeyDown(e) {
    if (e.key === 'Backspace' && query === '' && selected.length > 0) {
      removeSkill(selected[selected.length - 1]);
      return;
    }

    if (!isOpen || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIndex]) {
        addSkill(filtered[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div className="skill-multi-select" ref={containerRef}>
      <label className="skill-multi-label">Skills</label>
      <div
        className="skill-multi-input-area"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((skill) => (
          <span className="skill-chip" key={skill}>
            {skill}
            <button
              type="button"
              className="skill-chip-remove"
              onClick={(e) => {
                e.stopPropagation();
                removeSkill(skill);
              }}
              aria-label={`Remove ${skill}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="skill-multi-input"
          value={query}
          placeholder={selected.length === 0 ? 'Search skills...' : ''}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search skills"
          autoComplete="off"
        />
      </div>

      {isOpen && filtered.length > 0 && (
        <ul className="skill-dropdown" role="listbox">
          {filtered.slice(0, 20).map((opt, idx) => (
            <li
              key={opt}
              role="option"
              className={`skill-dropdown-item ${idx === highlightIndex ? 'highlighted' : ''}`}
              aria-selected={idx === highlightIndex}
              onMouseEnter={() => setHighlightIndex(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                addSkill(opt);
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
