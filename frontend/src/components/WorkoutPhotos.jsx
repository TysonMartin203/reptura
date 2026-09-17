import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { compressImage } from '../compressImage';
import TagAutocompleteInput from './TagAutocompleteInput';
import { PHOTO_TAG_SUGGESTIONS } from '../data/photoTags';

export default function WorkoutPhotos({ workoutId, date }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [tagsInput, setTagsInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    api.getPhotosForWorkout(workoutId).then(setPhotos).catch(console.error).finally(() => setLoading(false));
  }, [workoutId]);

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
      fd.append('workoutId', workoutId);
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length) fd.append('tags', JSON.stringify(tags));
      const newPhotos = await api.uploadPhoto(fd);
      setPhotos(p => [...p, ...newPhotos]);
      setFiles([]); setPreviews([]); setTagsInput('');
      if (fileRef.current) fileRef.current.value = '';
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
        These stay private — never visible to friends, even in Feed or Social. Add several at once and tag them (e.g. "Back & Biceps", "Triceps") to track progress in specific areas later.
      </p>

      {loading ? <div className="spinner"/> : photos.length > 0 && (
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
      )}

      <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple ref={fileRef} onChange={onFiles} style={{marginBottom:'10px'}}/>
      {compressing && <p className="muted" style={{fontSize:'12px'}}>Optimizing photos…</p>}
      {previews.length > 0 && !compressing && (
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'10px'}}>
          {previews.map((src, i) => <img key={i} src={src} alt="preview" style={{width:'60px',height:'60px',objectFit:'cover',borderRadius:'var(--r-sm)'}}/>)}
        </div>
      )}
      <div className="field" style={{marginBottom:'10px'}}>
        <TagAutocompleteInput value={tagsInput} onChange={setTagsInput} suggestions={PHOTO_TAG_SUGGESTIONS} placeholder="e.g. Chest & Shoulders, Triceps" className="input" />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="button" className="btn-secondary" onClick={upload} disabled={uploading || compressing || !files.length}>
        {uploading ? 'Uploading…' : files.length > 1 ? `Upload ${files.length} Photos` : 'Upload Photo'}
      </button>
    </div>
  );
}
