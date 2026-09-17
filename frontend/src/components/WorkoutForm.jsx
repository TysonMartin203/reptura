import { useState, useRef, useEffect } from 'react';
import { LIFTING_EXERCISES, CARDIO_ACTIVITIES, CARDIO_TYPES, SPORT_NAMES, INTENSITY_LEVELS, DISTANCE_UNITS, calculateCardioCalories, formatPace } from '../data/exercises';
import { compressImage } from '../compressImage';
import { today } from '../dateUtils';
import { IconTrophy, IconCheck } from './Icons';
import VoiceNoteButton from './VoiceNoteButton';
import VoiceAppendButton from './VoiceAppendButton';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { displayWeight, toStorageWeight, weightUnitLabel } from '../units';
import TimeInput from './TimeInput';

function blankLiftingExercise() {
  return {
    category: 'lifting', exerciseName: '', notes: '',
    sets: '', reps: '', weight: '', perSetWeights: false, setsData: [],
  };
}

function LiftingNameInput({ value, onChange }) {
  const [show, setShow] = useState(false);

  const filtered = value.length >= 1
    ? LIFTING_EXERCISES.filter(e => e.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : [];

  function select(ex) { onChange(ex); setShow(false); }
  function handleChange(e) { onChange(e.target.value); setShow(true); }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        placeholder="e.g. Bench Press"
        value={value}
        onChange={handleChange}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        required
      />
      {show && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)', marginTop: '4px',
          boxShadow: 'var(--shadow)', overflow: 'hidden', maxHeight: '260px', overflowY: 'auto',
        }}>
          {filtered.map(ex => (
            <div key={ex} onMouseDown={() => select(ex)} style={{
              padding: '11px 14px', cursor: 'pointer', fontSize: '14px',
              borderBottom: '1px solid var(--border)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {ex}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({ ex, index, onChange, onRemove, canRemove, profileWeight }) {
  const { user } = useAuth();
  const weightUnit = user?.weightUnit || 'lbs';
  const wLabel = weightUnitLabel(weightUnit);
  const [showCardioDetails, setShowCardioDetails] = useState(false);
  const update = (patch) => onChange(index, { ...ex, ...patch });

  function setCategory(category) {
    if (category === 'lifting') onChange(index, { ...blankLiftingExercise(), notes: ex.notes });
    else onChange(index, {
      category: 'cardio', exerciseName: '', customName: '', notes: ex.notes,
      durationMinutes: '', distance: '', distanceUnit: user?.distanceUnit || 'mi', calories: '', avgHeartRate: '', pace: '', intensity: '',
    });
  }

  function togglePerSet() {
    const turningOn = !ex.perSetWeights;
    if (turningOn) {
      const n = parseInt(ex.sets, 10);
      if (!n || n < 1) { update({ perSetWeights: true, setsData: [] }); return; }
      const setsData = Array.from({ length: n }, (_, i) => ex.setsData[i] || { reps: ex.reps || '', weight: ex.weight || '' });
      // Clear the uniform weight now that each set carries its own — avoids a stale
      // value lingering on a disabled field and causing confusion (or bugs) later.
      update({ perSetWeights: true, setsData, weight: '' });
    } else {
      update({ perSetWeights: false, setsData: [] });
    }
  }

  function updateSetsCount(val) {
    const n = parseInt(val, 10);
    let setsData = ex.setsData;
    if (ex.perSetWeights && n > 0) {
      setsData = Array.from({ length: n }, (_, i) => ex.setsData[i] || { reps: ex.reps || '', weight: '' });
    }
    update({ sets: val, setsData });
  }

  function updateSetRow(i, patch) {
    const setsData = ex.setsData.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    update({ setsData });
  }

  // Cardio/sport derived values — computed fresh from a formula each render,
  // not stored as separate live state, so they can never drift out of sync.
  const isSport = ex.category === 'cardio' && SPORT_NAMES.includes(ex.exerciseName);
  const cardioType = ex.category === 'cardio' ? CARDIO_TYPES[ex.exerciseName] : null;
  const metric = cardioType?.metric || (ex.category === 'cardio' ? 'distance' : null);
  // Sports always use the intensity selector; other cardio uses it only where
  // pace doesn't reliably predict effort (see calorieMode in exercises.js).
  const usesIntensity = isSport || cardioType?.calorieMode === 'intensity';
  const autoCalories = ex.category === 'cardio' && ex.exerciseName
    ? calculateCardioCalories(ex.exerciseName, ex, profileWeight)
    : null;

  let autoPace = null;
  if (!isSport && ex.durationMinutes && ex.distance && Number(ex.distance) > 0) {
    const secondsPerUnit = (Number(ex.durationMinutes) * 60) / Number(ex.distance);
    if (metric === 'distance') autoPace = formatPace(secondsPerUnit) ? `${formatPace(secondsPerUnit)}/${ex.distanceUnit}` : null;
    else if (metric === 'laps') autoPace = formatPace(secondsPerUnit) ? `${formatPace(secondsPerUnit)}/lap` : null;
  }

  // Keep the actual saved fields (calories, pace) in sync with the computed
  // display values, so what gets submitted matches what's shown.
  useEffect(() => {
    if (ex.category === 'cardio' && autoCalories != null && Number(ex.calories) !== autoCalories) {
      update({ calories: String(autoCalories) });
    }
  }, [ex.category, autoCalories]);
  useEffect(() => {
    if (!isSport && (metric === 'distance' || metric === 'laps') && ex.pace !== (autoPace || '')) {
      update({ pace: autoPace || '' });
    }
  }, [isSport, metric, autoPace]);

  function handleActivityChange(name) {
    const newIsSport = SPORT_NAMES.includes(name);
    const newMetric = CARDIO_TYPES[name]?.metric;
    if (newIsSport) {
      update({ exerciseName: name, customName: '', distance: '', distanceUnit: '', pace: '', intensity: ex.intensity || '' });
    } else {
      update({
        exerciseName: name, customName: '', intensity: '',
        distanceUnit: newMetric === 'laps' ? 'laps' : newMetric === 'flights' ? 'flights' : newMetric === 'holes' ? 'holes' : (user?.distanceUnit || 'mi'),
        distance: '',
      });
    }
  }

  return (
    <div className="exercise-card">
      <div className="exercise-card-head">
        <div className="category-toggle">
          <button type="button" className={ex.category === 'lifting' ? 'active' : ''} onClick={() => setCategory('lifting')}>Lifting</button>
          <button type="button" className={ex.category === 'cardio' ? 'active' : ''} onClick={() => setCategory('cardio')}>Cardio</button>
        </div>
        {canRemove && (
          <button type="button" className="btn-ghost-sm" onClick={() => onRemove(index)}>Remove</button>
        )}
      </div>

      {ex.category === 'lifting' ? (
        <>
          <div className="field">
            <label className="label">Exercise</label>
            <LiftingNameInput value={ex.exerciseName} onChange={v => update({ exerciseName: v })} />
          </div>
          <div className="input-row">
            <div className="input-group">
              <label className="label">Sets</label>
              <input className="input" type="number" min="1" placeholder="3" value={ex.sets}
                onChange={e => updateSetsCount(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="label">Reps</label>
              <input className="input" type="number" min="1" placeholder="8" value={ex.reps}
                onChange={e => update({ reps: e.target.value })} disabled={ex.perSetWeights} />
            </div>
            <div className="input-group">
              <label className="label">Weight ({wLabel})</label>
              <input className="input" type="number" min="0" step={weightUnit==='kg'?'1':'2.5'} placeholder={weightUnit==='kg'?'60':'135'} value={displayWeight(ex.weight, weightUnit)}
                onChange={e => update({ weight: toStorageWeight(e.target.value, weightUnit) })} disabled={ex.perSetWeights} />
            </div>
          </div>

          <label className="checkbox-row">
            <input type="checkbox" checked={ex.perSetWeights} onChange={togglePerSet} />
            <span>Split sets</span>
          </label>

          {ex.perSetWeights && (!ex.sets || parseInt(ex.sets, 10) < 1) && (
            <p className="form-error">Enter a number of sets first.</p>
          )}

          {ex.perSetWeights && ex.sets && parseInt(ex.sets, 10) >= 1 && (
            <div className="set-grid">
              {ex.setsData.map((s, i) => (
                <div className="set-row" key={i}>
                  <span className="set-row-label">Set {i + 1}</span>
                  <input className="input" type="number" min="1" placeholder="Reps" value={s.reps}
                    onChange={e => updateSetRow(i, { reps: e.target.value })} />
                  <input className="input" type="number" min="0" step={weightUnit==='kg'?'1':'2.5'} placeholder={`Weight (${wLabel})`} value={displayWeight(s.weight, weightUnit)}
                    onChange={e => updateSetRow(i, { weight: toStorageWeight(e.target.value, weightUnit) })} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="field">
            <label className="label">Activity</label>
            <select className="input" value={ex.exerciseName} onChange={e => handleActivityChange(e.target.value)} required>
              <option value="" disabled>Select an activity</option>
              <optgroup label="Cardio">
                {CARDIO_ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
              </optgroup>
              <optgroup label="Sports">
                {SPORT_NAMES.map(a => <option key={a} value={a}>{a}</option>)}
              </optgroup>
            </select>
          </div>
          {ex.exerciseName === 'Other' && (
            <div className="field">
              <label className="label">Activity name</label>
              <input className="input" placeholder="e.g. Kickboxing" value={ex.customName || ''}
                onChange={e => update({ customName: e.target.value })} required />
            </div>
          )}
          <p className="muted" style={{ margin: '0 0 4px', fontSize: '12px' }}>Calories are calculated automatically below.</p>
          <div className="field">
            <label className="label">Duration (min:sec)</label>
            <TimeInput minutesDecimal={ex.durationMinutes} onChange={v => update({ durationMinutes: v })} />
          </div>

          {!isSport && metric === 'distance' && (
            <div className="input-row">
              <div className="input-group">
                <label className="label">Distance</label>
                <input className="input" type="number" min="0" step="0.01" placeholder="3.1" value={ex.distance}
                  onChange={e => update({ distance: e.target.value })} />
              </div>
              <div className="input-group" style={{ maxWidth: '90px' }}>
                <label className="label">Unit</label>
                <select className="input" value={ex.distanceUnit} onChange={e => update({ distanceUnit: e.target.value })}>
                  {DISTANCE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          )}
          {!isSport && metric === 'laps' && (
            <div className="field">
              <label className="label">Laps</label>
              <input className="input" type="number" min="0" step="1" placeholder="20" value={ex.distance}
                onChange={e => update({ distance: e.target.value })} />
            </div>
          )}
          {!isSport && metric === 'flights' && (
            <div className="field">
              <label className="label">Flights of Stairs</label>
              <input className="input" type="number" min="0" step="1" placeholder="15" value={ex.distance}
                onChange={e => update({ distance: e.target.value })} />
            </div>
          )}
          {!isSport && metric === 'holes' && (
            <div className="field">
              <label className="label">Holes Played</label>
              <input className="input" type="number" min="0" step="1" placeholder="18" value={ex.distance}
                onChange={e => update({ distance: e.target.value })} />
            </div>
          )}

          {usesIntensity && (
            <div className="field">
              <label className="label">Intensity</label>
              <div className="tab-row">
                {INTENSITY_LEVELS.map(level => (
                  <button key={level} type="button" className={ex.intensity === level ? 'tab active' : 'tab'} onClick={() => update({ intensity: level })}>
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {autoPace && (
            <p className="muted" style={{ fontSize: '12px', margin: '4px 0 8px' }}>Pace: {autoPace}</p>
          )}
          {autoCalories != null && (
            <p style={{ fontSize: '13px', fontWeight: '700', margin: '2px 0 8px' }}>≈ {autoCalories} calories</p>
          )}
          {!profileWeight && ex.durationMinutes && (usesIntensity ? ex.intensity : ex.distance) && (
            <p className="muted" style={{ fontSize: '12px', margin: '0 0 8px' }}>Add your weight to your Meal & Workout Profile to calculate calories.</p>
          )}

          <button type="button" className="btn-ghost-sm" onClick={() => setShowCardioDetails(s => !s)} style={{marginBottom: showCardioDetails ? '10px' : 0}}>
            {showCardioDetails ? '− Fewer details' : '+ More details (heart rate)'}
          </button>
          {showCardioDetails && (
            <div className="field">
              <label className="label">Avg heart rate</label>
              <input className="input" type="number" min="0" placeholder="150" value={ex.avgHeartRate}
                onChange={e => update({ avgHeartRate: e.target.value })} />
            </div>
          )}
        </>
      )}

      <div className="field">
        <label className="label" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          Exercise notes (optional)
          <VoiceAppendButton onAppend={text => update({ notes: ex.notes ? `${ex.notes} ${text}` : text })}/>
        </label>
        <textarea className="input" rows={2} placeholder="How did it feel?" value={ex.notes}
          onChange={e => update({ notes: e.target.value })} />
      </div>
    </div>
  );
}

const DRAFT_KEY = 'reptura_workout_draft';

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveDraft(data) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* storage full or unavailable — not critical */ }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

export default function WorkoutForm({ mode = 'create', initial, onSubmit, onDelete, onRemovePhoto }) {
  const { user } = useAuth();
  // Drafts only apply to a genuinely fresh log (not editing, not prefilled from a plan) —
  // protects against losing everything if you navigate away mid-entry.
  const isDraftable = mode === 'create' && !initial;
  const draft = isDraftable ? loadDraft() : null;
  const [usingDraft, setUsingDraft] = useState(!!draft);

  const [name,         setName]         = useState(draft?.name ?? initial?.name ?? '');
  const [date,         setDate]         = useState(draft?.date ?? initial?.date ?? today());
  const [notesBefore,  setNotesBefore]  = useState(draft?.notesBefore ?? initial?.notesBefore ?? '');
  const [notesAfter,   setNotesAfter]   = useState(draft?.notesAfter ?? initial?.notesAfter ?? '');
  const [exercises,    setExercises]    = useState(
    draft?.exercises?.length ? draft.exercises : (initial?.exercises?.length ? initial.exercises : [blankLiftingExercise()])
  );
  const [photoFile,    setPhotoFile]    = useState(null);
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(initial?.photoUrl || null);
  const [hasExistingPhoto, setHasExistingPhoto] = useState(!!initial?.photoUrl);
  const [showRemovePhotoPopup, setShowRemovePhotoPopup] = useState(false);
  const [error,        setError]        = useState('');
  const [result,       setResult]       = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [profileWeight, setProfileWeight] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    api.getProfile().then(d => { if (d.profile?.weight) setProfileWeight(Number(d.profile.weight)); }).catch(()=>{});
  }, []);

  // Auto-save a draft as they type, so an accidental navigation away doesn't lose it —
  // but not if the form is still completely blank, since there'd be nothing to protect.
  useEffect(() => {
    if (!isDraftable) return;
    const hasContent = name || notesBefore || notesAfter || exercises.some(e =>
      e.exerciseName || e.sets || e.reps || e.weight || e.durationMinutes || e.distance || e.notes || e.customName
    );
    if (!hasContent) return;
    saveDraft({ name, date, notesBefore, notesAfter, exercises });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, date, notesBefore, notesAfter, exercises]);

  function discardDraft() {
    clearDraft();
    setUsingDraft(false);
    setName(''); setDate(today()); setNotesBefore(''); setNotesAfter('');
    setExercises([blankLiftingExercise()]);
  }

  async function confirmRemovePhoto(keep) {
    setShowRemovePhotoPopup(false);
    if (onRemovePhoto) {
      try { await onRemovePhoto(keep); } catch { /* surfaced by parent if needed */ }
    }
    setPhotoPreview(null);
    setHasExistingPhoto(false);
    setPhotoFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function updateExercise(i, next) {
    setExercises(prev => prev.map((e, idx) => idx === i ? next : e));
  }
  function removeExercise(i) {
    setExercises(prev => prev.filter((_, idx) => idx !== i));
  }
  function addExercise() {
    setExercises(prev => [...prev, blankLiftingExercise()]);
  }

  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [saunaMinutes, setSaunaMinutes] = useState('');
  function addSauna() {
    const minutes = Number(saunaMinutes);
    if (!minutes || minutes <= 0) return;
    setExercises(prev => [...prev, {
      category: 'cardio', exerciseName: 'Sauna', customName: '', notes: '',
      durationMinutes: String(minutes), distance: '', distanceUnit: user?.distanceUnit || 'mi',
      calories: '', avgHeartRate: '', pace: '', intensity: 'Moderate',
    }]);
    setSaunaMinutes('');
  }
  // Loose match so "lateral raises" (spoken plural) matches "Lateral Raise" (canonical singular),
  // and similarly for any other minor spoken variation.
  function normalizeExerciseName(s) {
    return String(s || '').toLowerCase().trim().replace(/s$/, '');
  }

  async function handleWorkoutVoice(text) {
    setVoiceLoading(true); setVoiceError('');
    try {
      // Speech recognition frequently mishears "rep(s)" as "wrap(s)" — normalize before sending.
      const cleaned = text.replace(/\bwraps?\b/gi, m => m.toLowerCase() === 'wrap' ? 'rep' : 'reps');
      const { exercises: parsed } = await api.parseWorkoutVoice({ transcript: cleaned });
      if (!parsed || parsed.length === 0) {
        setVoiceError('Could not make that out — please try again.');
        return;
      }

      setExercises(prev => {
        const isBlankDefault = prev.length === 1 && !prev[0].exerciseName && !prev[0].sets && !prev[0].weight && !prev[0].durationMinutes;
        let next = isBlankDefault ? [] : [...prev];

        parsed.forEach(p => {
          const isCardio = String(p.category || '').toLowerCase().startsWith('cardio');
          const matchedActivity = isCardio ? CARDIO_ACTIVITIES.find(a => a.toLowerCase() === String(p.exerciseName || '').toLowerCase()) : null;
          // For lifting, prefer the canonical list name on a loose match, so voice input stays
          // consistent with the picker/autocomplete rather than introducing near-duplicate names.
          const canonicalLift = !isCardio
            ? LIFTING_EXERCISES.find(e => normalizeExerciseName(e) === normalizeExerciseName(p.exerciseName))
            : null;
          const pName = isCardio ? (matchedActivity || p.exerciseName || '') : (canonicalLift || p.exerciseName || '');

          // If this exercise is already in the list (e.g. prefilled from a workout plan with
          // sets/reps still blank, or "lateral raises" spoken when "Lateral Raise" is already there),
          // fill in the spoken details there instead of adding a duplicate.
          const existingIdx = next.findIndex(e =>
            e.category === (isCardio ? 'cardio' : 'lifting') &&
            normalizeExerciseName(e.exerciseName) === normalizeExerciseName(pName) && pName
          );

          // Different reps/weight called out per set ("first set 10 at 135, second set 8 at 155")
          const hasPerSets = !isCardio && Array.isArray(p.perSets) && p.perSets.length > 1;
          const perSetsData = hasPerSets ? p.perSets.map(s => ({ reps: s.reps || '', weight: s.weight || '' })) : null;

          if (existingIdx !== -1) {
            next[existingIdx] = isCardio ? {
              ...next[existingIdx],
              durationMinutes: p.durationMinutes ?? next[existingIdx].durationMinutes,
              distance: p.distance ?? next[existingIdx].distance,
              distanceUnit: p.distanceUnit || next[existingIdx].distanceUnit,
            } : hasPerSets ? {
              ...next[existingIdx],
              perSetWeights: true, setsData: perSetsData, sets: String(perSetsData.length),
            } : {
              ...next[existingIdx],
              sets: p.sets ?? next[existingIdx].sets,
              reps: p.reps ?? next[existingIdx].reps,
              weight: p.weight ?? next[existingIdx].weight,
            };
          } else if (isCardio) {
            next = [...next, {
              category: 'cardio', exerciseName: matchedActivity || 'Other',
              customName: matchedActivity ? '' : (p.exerciseName || ''), notes: '',
              durationMinutes: p.durationMinutes || '', distance: p.distance || '',
              distanceUnit: p.distanceUnit || user?.distanceUnit || 'mi',
              calories: '', avgHeartRate: '', pace: '',
            }];
          } else if (hasPerSets) {
            next = [...next, {
              category: 'lifting', exerciseName: pName, notes: '',
              sets: String(perSetsData.length), reps: '', weight: '',
              perSetWeights: true, setsData: perSetsData,
            }];
          } else {
            next = [...next, {
              category: 'lifting', exerciseName: pName, notes: '',
              sets: p.sets || '', reps: p.reps || '', weight: p.weight || '', perSetWeights: false, setsData: [],
            }];
          }
        });

        return next.length ? next : [blankLiftingExercise()];
      });
    } catch (err) {
      console.error(err);
      setVoiceError('Sorry, I couldn\'t catch that — please try again.');
    } finally {
      setVoiceLoading(false);
    }
  }
  async function onPhoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    setCompressingPhoto(true);
    const compressed = await compressImage(f);
    setPhotoFile(compressed);
    setPhotoPreview(URL.createObjectURL(compressed));
    setCompressingPhoto(false);
  }

  async function submit(e) {
    e.preventDefault();
    setError(''); setResult(null);

    for (const ex of exercises) {
      if (ex.perSetWeights && (!ex.sets || parseInt(ex.sets, 10) < 1)) {
        setError('Enter a number of sets before using per-set weights.');
        return;
      }
    }

    const payload = {
      name: name.trim() || null, date, notesBefore, notesAfter,
      exercises: exercises.map(ex => {
        if (ex.category === 'lifting') {
          return {
            category: 'lifting',
            exerciseName: ex.exerciseName,
            notes: ex.notes,
            sets: ex.sets || null,
            reps: ex.perSetWeights ? null : (ex.reps || null),
            weight: ex.perSetWeights ? null : (ex.weight || null),
            perSetWeights: !!ex.perSetWeights,
            setsData: ex.perSetWeights ? ex.setsData : [],
          };
        }
        return {
          category: 'cardio',
          exerciseName: ex.exerciseName === 'Other' ? (ex.customName || 'Other') : ex.exerciseName,
          notes: ex.notes,
          durationMinutes: ex.durationMinutes || null,
          distance: ex.distance || null,
          distanceUnit: ex.distanceUnit || null,
          calories: ex.calories || null,
          avgHeartRate: ex.avgHeartRate || null,
          pace: ex.pace || null,
        };
      }),
    };

    setLoading(true);
    try {
      const data = await onSubmit(payload, photoFile);
      setResult(data);
      if (isDraftable) clearDraft();
      if (mode === 'create') {
        setName('');
        setExercises([blankLiftingExercise()]);
        setNotesBefore(''); setNotesAfter('');
        setPhotoFile(null); setPhotoPreview(null); setHasExistingPhoto(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const newPRs = (result?.prResults || []).filter(p => p.isNewPR);

  return (
    <form onSubmit={submit} className="form-stack">
      {usingDraft && (
        <div className="glass-card" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px'}}>
          <span style={{fontSize:'13px'}}>Resumed your unsaved workout.</span>
          <button type="button" className="btn-ghost-sm" onClick={discardDraft}>Discard</button>
        </div>
      )}

      <div className="field">
        <label className="label">Workout Name (optional)</label>
        <input className="input" placeholder="e.g. Leg Day" value={name} onChange={e => setName(e.target.value)} />
      </div>

      <div className="field">
        <label className="label">Date</label>
        <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
      </div>

      <div className="field">
        <label className="label" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          Notes before workout (optional)
          <VoiceAppendButton onAppend={text => setNotesBefore(prev => prev ? `${prev} ${text}` : text)}/>
        </label>
        <textarea className="input" rows={2} placeholder="How are you feeling going in?" value={notesBefore} onChange={e => setNotesBefore(e.target.value)} />
      </div>

      <div className="field">
        <label className="label">Or Say Your Workout (optional)</label>
        <VoiceNoteButton label="Describe Your Exercises" onTranscript={handleWorkoutVoice}/>
        {voiceLoading && <p className="muted" style={{fontSize:'12px',marginTop:'6px'}}>Working it out…</p>}
        {voiceError && <p className="form-error" style={{marginTop:'6px'}}>{voiceError}</p>}
      </div>

      {exercises.map((ex, i) => (
        <ExerciseCard
          key={i} ex={ex} index={i}
          onChange={updateExercise} onRemove={removeExercise}
          canRemove={exercises.length > 1}
          profileWeight={profileWeight}
        />
      ))}

      <button type="button" className="btn-secondary" onClick={addExercise}>+ Add Exercise</button>

      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
        <input className="input" type="number" min="1" placeholder="Minutes" value={saunaMinutes}
          onChange={e=>setSaunaMinutes(e.target.value)} style={{maxWidth:'110px'}} />
        <button type="button" className="btn-ghost-sm" onClick={addSauna}>+ Add Sauna Session</button>
      </div>

      <div className="field">
        <label className="label" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          Notes after workout (optional)
          <VoiceAppendButton onAppend={text => setNotesAfter(prev => prev ? `${prev} ${text}` : text)}/>
        </label>
        <textarea className="input" rows={2} placeholder="How'd it go?" value={notesAfter} onChange={e => setNotesAfter(e.target.value)} />
      </div>

      <div className="field">
        <label className="label">Progress photo (optional)</label>
        {!hasExistingPhoto && (
          <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" ref={fileRef} onChange={onPhoto} />
        )}
      </div>
      {compressingPhoto && <p className="muted" style={{fontSize:'12px'}}>Optimizing photo…</p>}
      {photoPreview && !compressingPhoto && (
        <div>
          <img src={photoPreview} alt="preview" className="photo-preview" />
          {hasExistingPhoto && (
            <button type="button" className="btn-ghost-sm" style={{marginTop:'8px'}} onClick={()=>setShowRemovePhotoPopup(true)}>
              Remove Photo
            </button>
          )}
        </div>
      )}
      {showRemovePhotoPopup && (
        <div className="glass-card" style={{marginTop:'-8px'}}>
          <p style={{fontSize:'13px',fontWeight:'600',marginBottom:'10px'}}>Remove this photo from the workout?</p>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <button type="button" className="btn-accent-sm" onClick={()=>confirmRemovePhoto(true)}>Keep in Progress Photos</button>
            <button type="button" className="btn-danger-sm" onClick={()=>confirmRemovePhoto(false)}>Delete Completely</button>
            <button type="button" className="btn-ghost-sm" onClick={()=>setShowRemovePhotoPopup(false)}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      {result && (
        <div className={`result-banner ${newPRs.length ? 'pr-banner' : ''}`}>
          {newPRs.length
            ? newPRs.map(p => (
              <div key={p.exercise} style={{display:'flex',alignItems:'center',gap:'6px',justifyContent:'center'}}><IconTrophy style={{width:'16px',height:'16px'}}/> New PR — {p.exercise}: {p.previousMax != null ? `${p.unit === 'lbs' ? displayWeight(p.previousMax, user?.weightUnit) : p.previousMax} → ` : ''}{p.unit === 'lbs' ? displayWeight(p.newMax, user?.weightUnit) : p.newMax}{p.unit === 'lbs' ? ` ${weightUnitLabel(user?.weightUnit)}` : p.unit === 'reps' ? ' reps' : ''}</div>
            ))
            : <span style={{display:'flex',alignItems:'center',gap:'6px',justifyContent:'center'}}><IconCheck style={{width:'16px',height:'16px'}}/> Workout {mode === 'edit' ? 'updated' : 'logged'}!</span>}
        </div>
      )}

      <button className="btn-primary" type="submit" disabled={loading || compressingPhoto}>
        {loading ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Log Workout'}
      </button>

      {mode === 'edit' && (
        <button type="button" className="btn-danger" onClick={onDelete}>
          Delete Workout
        </button>
      )}
    </form>
  );
}
