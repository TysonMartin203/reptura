import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { compressImage } from '../compressImage';
import TagAutocompleteInput from './TagAutocompleteInput';
import { PHOTO_TAG_SUGGESTIONS } from '../data/photoTags';

// Two modes:
//  • staged  — used while logging a new workout, before the workout exists.
//    Nothing uploads; the picked photos are handed up to the form, which
//    uploads them once the workout has been created and has an id.
//  • live    — used on an existing workout (editing). Uploads straight away.
// Either way each photo carries its own tags, so a single batch can mix
// "Back & Biceps" with "Triceps" instead of stamping one label across all.

export function splitTags(value) {
  return String(value || '').split(',').map(t => t.trim()).filter(Boolean);
}

let uid = 0;

export default function WorkoutPhotos({ workoutId, date, staged = false, onStagedChange }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(!staged);
  const [pending, setPending] = useState([]); // { key, file, preview, tags }
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    if (staged || !workoutId) return;
    api.getPhotosForWorkout(workoutId).then(setPhotos).catch(console.error).finally(() => setLoading(false));
  }, [workoutId, staged]);

  // Keep the parent's copy in step in staged mode.
  useEffect(() => {
    if (staged && onStagedChange) onStagedChange(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  async function onFiles(e) {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setCompressing(true);
    setError('');
    try {
      const compressed = await Promise.all(picked.map(f => compressImage(f)));
      setPending(prev => [
        ...prev,
        ...compressed.map(f => ({ key: ++uid, file: f, preview: URL.createObjectURL(f), tags: '' })),
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setCompressing(false);
      // Clear the input so picking the same file again still fires onChange.
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function setTagsFor(key, value) {
    setPending(prev => prev.map(p => (p.key === key ? { ...p, tags: value } : p)));
  }

  function removePending(key) {
    setPending(prev => {
      const hit = prev.find(p => p.key === key);
      if (hit) URL.revokeObjectURL(hit.preview);
      return prev.filter(p => p.key !== key);
    });
  }

  async function upload() {
    if (!pending.length) return setError('Pick at least one photo first');
    setError(''); setUploading(true);
    try {
      const fd = new FormData();
      pending.forEach(p => fd.append('photos', p.file));
      fd.append('photoDate', date);
      fd.append('workoutId', workoutId);
      // Index-aligned with the files above, one tag list per photo.
      fd.append('tagsPerFile', JSON.stringify(pending.map(p => splitTags(p.tags))));
      const newPhotos = await api.uploadPhoto(fd);
      setPhotos(p => [...p, ...newPhotos]);
      pending.forEach(p => URL.revokeObjectURL(p.preview));
      setPending([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id) {
    setPhotos(p => p.filter(x => x.id !== id));
    try { await api.deletePhoto(id); } catch {}
  }

  return (
    <div className="card-form" style={{marginTop:'16px'}}>
      <div style={{fontWeight:'700',fontSize:'14px',marginBottom:'10px'}}>Progress Photos for This Workout</div>
      <p className="muted" style={{fontSize:'12px',marginBottom:'10px'}}>
        These stay private — never visible to friends, even in Feed or Social. Add as many as you like at once
        and give each its own tag (e.g. "Back &amp; Biceps", "Triceps") to track specific areas over time.
        {staged && ' They upload with the workout when you log it.'}
      </p>

      {!staged && (loading ? <div className="spinner"/> : photos.length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'14px'}}>
          {photos.map(ph => (
            <div key={ph.id} style={{position:'relative'}}>
              <img src={api.fileUrl(ph.file_path)} alt="" style={{width:'80px',height:'80px',objectFit:'cover',borderRadius:'var(--r-sm)',border:'1px solid var(--border)'}}/>
              {ph.tags?.length > 0 && (
                <div className="muted" style={{fontSize:'10px',textAlign:'center',marginTop:'2px',maxWidth:'80px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ph.tags.join(', ')}</div>
              )}
              <button type="button" onClick={()=>remove(ph.id)}
                style={{position:'absolute',top:'-6px',right:'-6px',width:'20px',height:'20px',borderRadius:'50%',background:'var(--danger)',color:'#fff',border:'2px solid var(--bg)',fontSize:'12px',lineHeight:1,cursor:'pointer'}}>
                ×
              </button>
            </div>
          ))}
        </div>
      ))}

      <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple ref={fileRef}
        onChange={onFiles} style={{marginBottom:'10px'}}/>
      {compressing && <p className="muted" style={{fontSize:'12px'}}>Optimizing photos…</p>}

      {pending.map(p => (
        <div key={p.key} style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
          <img src={p.preview} alt="" style={{width:'56px',height:'56px',objectFit:'cover',borderRadius:'var(--r-sm)',flexShrink:0,border:'1px solid var(--border)'}}/>
          <div style={{flex:1,minWidth:0}}>
            <TagAutocompleteInput value={p.tags} onChange={v => setTagsFor(p.key, v)}
              suggestions={PHOTO_TAG_SUGGESTIONS} placeholder="Tag this photo (optional)" className="input" />
          </div>
          <button type="button" className="btn-ghost-sm" style={{color:'var(--danger)',flexShrink:0}}
            onClick={()=>removePending(p.key)}>Remove</button>
        </div>
      ))}

      {error && <p className="form-error">{error}</p>}

      {!staged && (
        <button type="button" className="btn-secondary" onClick={upload} disabled={uploading || compressing || !pending.length}>
          {uploading ? 'Uploading…' : pending.length > 1 ? `Upload ${pending.length} Photos` : 'Upload Photo'}
        </button>
      )}
    </div>
  );
}
