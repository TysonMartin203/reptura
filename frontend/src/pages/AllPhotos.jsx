import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { compressImage } from '../compressImage';
import { today, formatDateStr } from '../dateUtils';
import TagAutocompleteInput from '../components/TagAutocompleteInput';
import { PHOTO_TAG_SUGGESTIONS } from '../data/photoTags';

export default function AllPhotos() {
  const [photos,    setPhotos]    = useState([]);
  const [date,      setDate]      = useState(today());
  const [files,     setFiles]     = useState([]);
  const [previews,  setPreviews]  = useState([]);
  const [tagsInput, setTagsInput] = useState('');
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error,     setError]     = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTagsInput, setEditTagsInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    api.getPhotos().then(setPhotos).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function onFiles(e) {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setCompressing(true);
    const compressed = await Promise.all(picked.map(f => compressImage(f)));
    setFiles(compressed);
    setPreviews(compressed.map(f => URL.createObjectURL(f)));
    setCompressing(false);
  }

  async function upload(e) {
    e.preventDefault();
    if (!files.length) return setError('Select at least one photo first');
    setError(''); setUploading(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('photos', f));
      fd.append('photoDate', date);
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length) fd.append('tags', JSON.stringify(tags));
      const newPhotos = await api.uploadPhoto(fd);
      setPhotos(p => [...newPhotos, ...p]);
      setFiles([]); setPreviews([]); setTagsInput('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  // Every tag currently in use, for the filter bar — derived from what's
  // actually on photos, not a separate managed list.
  const allTags = [...new Set(photos.flatMap(p => p.tags || []))].sort();
  const visiblePhotos = activeTag ? photos.filter(p => (p.tags || []).includes(activeTag)) : photos;

  function startEditTags(ph) {
    setEditingId(ph.id);
    setEditTagsInput((ph.tags || []).join(', '));
  }

  async function saveTags(id) {
    setSavingTags(true);
    try {
      const tags = editTagsInput.split(',').map(t => t.trim()).filter(Boolean);
      await api.updatePhotoTags(id, tags);
      setPhotos(p => p.map(ph => ph.id === id ? { ...ph, tags } : ph));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTags(false);
    }
  }

  if (loading) return <div className="page"><div className="spinner"/></div>;

  return (
    <div className="page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h2 className="page-title" style={{marginBottom:0}}>All Photos</h2>
        <Link to="/photos" className="link-small">← Progress</Link>
      </div>

      <div className="card-form">
        <form onSubmit={upload} className="form-stack">
          <div className="field">
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label">Photos</label>
            <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple ref={fileRef} onChange={onFiles} />
            <p className="muted" style={{fontSize:'12px',marginTop:'4px'}}>Select multiple at once — handy for several angles from the same session.</p>
          </div>
          <div className="field">
            <label className="label">Tags (optional)</label>
            <TagAutocompleteInput value={tagsInput} onChange={setTagsInput} suggestions={PHOTO_TAG_SUGGESTIONS} placeholder="e.g. Chest & Shoulders, Back" />
            <p className="muted" style={{fontSize:'12px',marginTop:'4px'}}>Comma-separated — start typing to see suggestions. Applies to all photos in this upload. Use these later to filter progress by muscle group.</p>
          </div>
          {compressing && <p className="muted" style={{fontSize:'12px'}}>Optimizing photos…</p>}
          {previews.length > 0 && !compressing && (
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
              {previews.map((src, i) => <img key={i} src={src} alt="preview" className="photo-preview" style={{width:'80px',height:'80px',objectFit:'cover'}} />)}
            </div>
          )}
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={uploading || compressing}>
            {uploading ? 'Uploading…' : files.length > 1 ? `Upload ${files.length} Photos` : 'Upload Photo'}
          </button>
        </form>
      </div>

      {allTags.length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'16px'}}>
          <button className={activeTag===null ? 'tab active' : 'tab'} onClick={()=>setActiveTag(null)} style={{fontSize:'12px'}}>All</button>
          {allTags.map(t => (
            <button key={t} className={activeTag===t ? 'tab active' : 'tab'} onClick={()=>setActiveTag(t)} style={{fontSize:'12px'}}>{t}</button>
          ))}
        </div>
      )}

      {visiblePhotos.length === 0
        ? <p className="muted">{activeTag ? `No photos tagged "${activeTag}" yet.` : 'No photos yet. Upload your first progress photo!'}</p>
        : (
          <div className="photo-grid">
            {visiblePhotos.map((ph, i) => (
              <div key={ph.id} className="photo-card" style={{animationDelay:`${i*.05}s`}}>
                <img
                  src={api.fileUrl(ph.file_path)}
                  alt={ph.photo_date}
                  className="photo-img"
                  style={{ cursor: 'pointer' }}
                  onClick={() => editingId === ph.id ? setEditingId(null) : startEditTags(ph)}
                />
                {editingId === ph.id ? (
                  <div className="photo-footer" style={{flexDirection:'column',alignItems:'stretch',gap:'6px'}}>
                    <TagAutocompleteInput value={editTagsInput} onChange={setEditTagsInput} suggestions={PHOTO_TAG_SUGGESTIONS} placeholder="e.g. Legs" className="input" />
                    <div style={{display:'flex',gap:'6px'}}>
                      <button className="btn-primary" style={{flex:1,padding:'6px'}} disabled={savingTags} onClick={()=>saveTags(ph.id)}>{savingTags ? 'Saving…' : 'Save Tags'}</button>
                      <button className="btn-ghost-sm" onClick={()=>setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="photo-footer">
                    <div>
                      <div>{formatDateStr(ph.photo_date)}</div>
                      {ph.tags?.length > 0
                        ? <div className="muted" style={{fontSize:'11px'}}>{ph.tags.join(', ')}</div>
                        : <div className="muted" style={{fontSize:'11px'}}>Tap photo to tag</div>}
                    </div>
                    <button className="btn-ghost-sm" onClick={() => {
                      api.deletePhoto(ph.id);
                      setPhotos(p => p.filter(x => x.id !== ph.id));
                    }}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}
