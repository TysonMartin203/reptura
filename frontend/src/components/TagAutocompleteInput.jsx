import { useState, useRef, useEffect } from 'react';

// A plain text input for a comma-separated tag list, with a dropdown of
// suggestions filtered against whatever's currently being typed after the
// last comma. Clicking a suggestion fills in that segment and leaves the
// input ready to keep typing another tag.
export default function TagAutocompleteInput({ value, onChange, suggestions, placeholder, className = 'input' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const parts = value.split(',');
  const current = parts[parts.length - 1].trim().toLowerCase();
  const already = new Set(parts.slice(0, -1).map(t => t.trim().toLowerCase()));
  const matches = current === ''
    ? suggestions.filter(s => !already.has(s.toLowerCase()))
    : suggestions.filter(s => s.toLowerCase().includes(current) && !already.has(s.toLowerCase()));

  function pick(tag) {
    const newParts = [...parts.slice(0, -1), ` ${tag}`];
    onChange(newParts.join(',').replace(/^,\s*/, '').trimStart() + ', ');
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        className={className}
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
      />
      {open && matches.length > 0 && (
        <div className="card-form" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          marginTop: '4px', padding: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px',
        }}>
          {matches.map(tag => (
            <button key={tag} type="button" className="btn-ghost-sm" style={{ fontSize: '12px' }}
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(tag)}>
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
