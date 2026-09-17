import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { today, formatDateStr } from '../dateUtils';
import { IconTrash, IconCamera, IconPlus } from '../components/Icons';
import HandMeasureDiagram from '../components/HandMeasureDiagram';
import { compressImage } from '../compressImage';
import VoiceNoteButton from '../components/VoiceNoteButton';
import MacroProgressBar from '../components/MacroProgressBar';
import { getMacroGoals } from '../macroGoals';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function blankIngredient() {
  return { key: Math.random().toString(36).slice(2), name: '', calories: '', protein: '', carbs: '', fat: '' };
}

export default function LogMeal() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = location.state; // { mealType, name, calories, protein, carbs, fat } when arriving from a meal plan
  const editMeal = location.state?.editMeal; // full meal row when arriving from Meal History to edit

  const [date, setDate] = useState(editMeal?.date || today());
  const [mealType, setMealType] = useState(
    editMeal?.meal_type || (prefill?.mealType && MEAL_TYPES.includes(prefill.mealType) ? prefill.mealType : 'Breakfast')
  );
  const [ingredients, setIngredients] = useState(() => {
    if (editMeal) {
      const existing = editMeal.ingredients;
      if (Array.isArray(existing) && existing.length) {
        return existing.map(ing => ({ key: Math.random().toString(36).slice(2), name: ing.name || '', calories: ing.calories ?? '', protein: ing.protein ?? '', carbs: ing.carbs ?? '', fat: ing.fat ?? '' }));
      }
      // Older meals logged before per-ingredient breakdown existed — fall back to the single totals row.
      return [{ key: 'edit', name: editMeal.name || '', calories: editMeal.calories ?? '', protein: editMeal.protein ?? '', carbs: editMeal.carbs ?? '', fat: editMeal.fat ?? '' }];
    }
    if (prefill?.name) {
      return [{ key: 'prefill', name: prefill.name, calories: prefill.calories ?? '', protein: prefill.protein ?? '', carbs: prefill.carbs ?? '', fat: prefill.fat ?? '' }];
    }
    return [blankIngredient()];
  });
  const [logPercent, setLogPercent] = useState(100);
  const [notes, setNotes] = useState(editMeal?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [restaurantHint, setRestaurantHint] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [firstPhoto, setFirstPhoto] = useState(null);
  const [addingAngle, setAddingAngle] = useState(false);
  const [scanningLabel, setScanningLabel] = useState(false);
  const [labelResult, setLabelResult] = useState(null);
  const [labelServings, setLabelServings] = useState('1');
  const [labelError, setLabelError] = useState('');
  const fileRef = useRef();
  const secondFileRef = useRef();
  const labelFileRef = useRef();

  const [meals, setMeals] = useState([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [loadingDay, setLoadingDay] = useState(true);
  const [calorieGoal, setCalorieGoal] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    loadDay();
    api.getProfile().then(d => { setProfile(d.profile); if (d.profile?.calorieGoal) setCalorieGoal(Number(d.profile.calorieGoal)); }).catch(()=>{});
  }, [date]);

  function loadDay() {
    setLoadingDay(true);
    api.getMealsForDate(date)
      .then(d => { setMeals(d.meals); setTotals(d.totals); })
      .catch(console.error)
      .finally(() => setLoadingDay(false));
  }

  function updateIngredient(i, patch) {
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, ...patch } : ing));
  }
  // Rescales EVERY ingredient's macros by the ratio of the whole-log percent
  // change — e.g. going from 100% to 50% halves everything in the log, and
  // back to 100% restores the original amounts, since each change is
  // relative to the current value rather than a fixed base that could drift
  // with repeated edits.
  function updateLogPercent(newPercentRaw) {
    const newPercent = newPercentRaw === '' ? '' : Number(newPercentRaw);
    if (newPercent === '' || !logPercent || logPercent <= 0) { setLogPercent(newPercent); return; }
    const ratio = newPercent / logPercent;
    const scale = (v) => v === '' || v == null ? v : Math.round(Number(v) * ratio * 10) / 10;
    setIngredients(prev => prev.map(ing => ({ ...ing, calories: scale(ing.calories), protein: scale(ing.protein), carbs: scale(ing.carbs), fat: scale(ing.fat) })));
    setLogPercent(newPercent);
  }
  function addIngredient() {
    setIngredients(prev => [...prev, blankIngredient()]);
  }
  function removeIngredient(i) {
    setIngredients(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  }

  // Live running total as ingredient rows are edited — this is the number that actually gets logged.
  const liveTotals = ingredients.reduce((sum, ing) => ({
    calories: sum.calories + (Number(ing.calories) || 0),
    protein: sum.protein + (Number(ing.protein) || 0),
    carbs: sum.carbs + (Number(ing.carbs) || 0),
    fat: sum.fat + (Number(ing.fat) || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  function applyAiResult(result) {
    setLogPercent(100);
    if (result.items?.length > 0) {
      setIngredients(result.items.map(it => ({
        key: Math.random().toString(36).slice(2),
        name: it.portion ? `${it.item} (${it.portion})` : (it.item || ''),
        calories: it.calories ?? '', protein: it.protein ?? '', carbs: it.carbs ?? '', fat: it.fat ?? '',
      })));
    } else {
      setIngredients([{
        key: Math.random().toString(36).slice(2),
        name: result.name || '', calories: result.calories ?? '', protein: result.protein ?? '', carbs: result.carbs ?? '', fat: result.fat ?? '',
      }]);
    }
  }

  async function scanPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setScanning(true); setScanError('');
    try {
      const compressed = await compressImage(file, { maxDimension: 1536, quality: 0.85 });
      setFirstPhoto(compressed);
      const fd = new FormData();
      fd.append('photo', compressed);
      if (restaurantHint.trim()) fd.append('restaurant', restaurantHint.trim());
      const result = await api.recognizeFood(fd);
      applyAiResult(result);
      setScanResult(result);
    } catch (err) {
      setScanError(err.message || 'Could not read that photo — try a clearer shot or enter it manually.');
      setScanResult(null);
      setFirstPhoto(null);
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // A single photo can't show how tall or deep a pile of food is — a second
  // angle gives the model something to cross-reference, which meaningfully
  // improves portion-size accuracy beyond what temperature or prompting alone can.
  async function addSecondAngle(e) {
    const file = e.target.files[0];
    if (!file || !firstPhoto) return;
    setAddingAngle(true); setScanError('');
    try {
      const compressed = await compressImage(file, { maxDimension: 1536, quality: 0.85 });
      const fd = new FormData();
      fd.append('photo', firstPhoto);
      fd.append('photo2', compressed);
      if (restaurantHint.trim()) fd.append('restaurant', restaurantHint.trim());
      const result = await api.recognizeFood(fd);
      applyAiResult(result);
      setScanResult(result);
    } catch (err) {
      setScanError(err.message || 'Could not read that photo — try a clearer shot.');
    } finally {
      setAddingAngle(false);
      if (secondFileRef.current) secondFileRef.current.value = '';
    }
  }

  async function scanLabel(e) {
    const file = e.target.files[0];
    if (!file) return;
    setScanningLabel(true); setLabelError(''); setLabelResult(null);
    try {
      const compressed = await compressImage(file, { maxDimension: 1536, quality: 0.85 });
      const fd = new FormData();
      fd.append('photo', compressed);
      const result = await api.recognizeLabel(fd);
      setLabelResult(result);
      setLabelServings(result.servingsPerContainer ? '1' : '1');
    } catch (err) {
      setLabelError(err.message || 'Could not read that label — try a clearer, well-lit shot.');
    } finally {
      setScanningLabel(false);
      if (labelFileRef.current) labelFileRef.current.value = '';
    }
  }

  function addLabelToMeal(servingsOverride) {
    const servings = Number(servingsOverride ?? labelServings) || 0;
    if (!labelResult || servings <= 0) return;
    const label = servings === 1 ? '' : ` × ${servings}`;
    setIngredients(prev => {
      const cleanPrev = prev.filter(ing => ing.name.trim());
      return [...cleanPrev, {
        key: Math.random().toString(36).slice(2),
        name: `${labelResult.name || 'Scanned Item'}${label} (${labelResult.servingSize || 'per label'})`,
        calories: Math.round((labelResult.caloriesPerServing || 0) * servings) || '',
        protein: Math.round((labelResult.proteinPerServing || 0) * servings * 10) / 10 || '',
        carbs: Math.round((labelResult.carbsPerServing || 0) * servings * 10) / 10 || '',
        fat: Math.round((labelResult.fatPerServing || 0) * servings * 10) / 10 || '',
      }];
    });
    setLabelResult(null);
    setLabelServings('1');
  }


  async function handleVoiceTranscript(text) {
    setVoiceLoading(true); setVoiceError('');
    try {
      const result = await api.parseMealVoice({ transcript: text });
      if (result.mealType && MEAL_TYPES.includes(result.mealType)) setMealType(result.mealType);
      applyAiResult(result);
    } catch (err) {
      console.error(err);
      setVoiceError('Sorry, I couldn\'t catch that — please try again.');
    } finally {
      setVoiceLoading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const cleanIngredients = ingredients.filter(ing => ing.name.trim());
    if (cleanIngredients.length === 0) { setError('Add at least one item'); return; }
    setSaving(true); setError('');
    try {
      const name = cleanIngredients.map(i => i.name).join(', ');
      const payload = {
        date, mealType, name, notes,
        calories: liveTotals.calories || null, protein: liveTotals.protein || null, carbs: liveTotals.carbs || null, fat: liveTotals.fat || null,
        ingredients: cleanIngredients.map(({ key, ...rest }) => rest),
      };
      if (editMeal) {
        await api.updateLoggedMeal(editMeal.id, payload);
        navigate('/meals/history');
        return;
      }
      await api.logMeal(payload);
      setIngredients([blankIngredient()]); setNotes(''); setLogPercent(100); setRestaurantHint('');
      setScanResult(null);
      setFirstPhoto(null);
      loadDay();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function removeMeal(id) {
    setMeals(m => m.filter(x => x.id !== id));
    try { await api.deleteLoggedMeal(id); loadDay(); }
    catch { loadDay(); }
  }

  const effectiveGoal = calorieGoal ? calorieGoal + (totals.caloriesBurned || 0) : null;
  const overGoal = effectiveGoal && totals.calories > effectiveGoal;
  const macroGoals = getMacroGoals(profile, calorieGoal);

  return (
    <div className="page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h2 className="page-title" style={{marginBottom:0}}>{editMeal ? 'Edit Meal' : 'Log a Meal'}</h2>
        <Link to="/meals" className="link-small">← Meals</Link>
      </div>
      {prefill?.planLabel && (
        <p className="muted" style={{marginTop:'-12px',marginBottom:'16px',fontSize:'13px'}}>From plan: {prefill.planLabel}</p>
      )}

      <form onSubmit={submit} className="form-stack">
        {/* When & what meal */}
        <div className="card-form">
          <div className="input-row">
            <div className="input-group">
              <label className="label">Date</label>
              <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} required/>
            </div>
          </div>
          <div className="field" style={{marginTop:'10px',marginBottom:0}}>
            <label className="label">Meal</label>
            <div className="tab-row">
              {MEAL_TYPES.map(t => (
                <button type="button" key={t} className={mealType===t?'tab active':'tab'} onClick={()=>setMealType(t)}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        {/* AI quick-add helpers */}
        <div className="card-form">
          <div className="glass-card" style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px',border:'1px solid var(--accent)'}}>
            <HandMeasureDiagram size={52} showLine={false}/>
            <p style={{fontSize:'13px',fontWeight:'600',margin:0}}>Shoot from directly above with your open hand flat next to the food, palm facing up — top-down shots with a hand in frame give the most accurate size estimate. Set your palm width in your Meal & Workout Profile for the most accurate results.</p>
          </div>
          <div className="field">
            <label className="label">Restaurant (optional)</label>
            <input className="input" placeholder="e.g. McDonald's, Chipotle, Chick-fil-A" value={restaurantHint}
              onChange={e=>setRestaurantHint(e.target.value)} style={{marginBottom:'4px'}}/>
            <p className="muted" style={{fontSize:'11px'}}>If this is fast food or a chain restaurant, naming it lets the AI use their published nutrition info instead of a visual estimate — much more accurate.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={scanPhoto} style={{display:'none'}} id="food-photo-input"/>
          <label htmlFor="food-photo-input" className="btn-secondary" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',cursor:'pointer',marginBottom:'10px'}}>
            <IconCamera style={{width:'16px',height:'16px'}}/> {scanning ? 'Reading photo…' : 'Take or Choose a Photo'}
          </label>
          {scanError && <p className="form-error" style={{marginBottom:'8px'}}>{scanError}</p>}
          {scanResult && (
            <div className="glass-card" style={{marginBottom:'10px',padding:'12px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:'12px',fontWeight:'700'}}>AI estimate — edit the rows below if needed</span>
                <span style={{
                  fontSize:'11px',fontWeight:'700',padding:'2px 8px',borderRadius:'999px',flexShrink:0,marginLeft:'8px',
                  background: scanResult.confidence==='high' ? 'var(--sage)' : scanResult.confidence==='low' ? 'var(--danger)' : 'var(--accent)',
                  color:'#fff',
                }}>
                  {scanResult.confidence==='high' ? 'High confidence' : scanResult.confidence==='low' ? 'Low confidence' : 'Medium confidence'}
                </span>
              </div>
              {scanResult.notes && <p className="muted" style={{fontSize:'12px',marginTop:'6px',fontStyle:'italic'}}>{scanResult.notes}</p>}
              {firstPhoto && (
                <>
                  <input ref={secondFileRef} type="file" accept="image/*" onChange={addSecondAngle} style={{display:'none'}} id="food-photo-input-2"/>
                  <label htmlFor="food-photo-input-2" className="btn-ghost-sm" style={{display:'inline-flex',alignItems:'center',gap:'6px',cursor:'pointer',marginTop:'10px'}}>
                    <IconCamera style={{width:'13px',height:'13px'}}/> {addingAngle ? 'Reading second photo…' : '+ Add another angle for better accuracy'}
                  </label>
                </>
              )}
            </div>
          )}

          <p className="muted" style={{fontSize:'12px',margin:'0 0 8px'}}>Have a nutrition label instead? Scanning it gives exact values rather than an estimate.</p>
          <input ref={labelFileRef} type="file" accept="image/*" onChange={scanLabel} style={{display:'none'}} id="label-photo-input"/>
          <label htmlFor="label-photo-input" className="btn-ghost-sm" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',cursor:'pointer',marginBottom:'12px'}}>
            <IconCamera style={{width:'14px',height:'14px'}}/> {scanningLabel ? 'Reading label…' : 'Scan a Nutrition Label'}
          </label>
          {labelError && <p className="form-error" style={{marginBottom:'8px'}}>{labelError}</p>}
          {labelResult && (
            <div className="glass-card" style={{marginBottom:'12px',padding:'12px'}}>
              <div style={{fontSize:'13px',fontWeight:'700',marginBottom:'2px'}}>{labelResult.name || 'Scanned Item'}</div>
              <div className="muted" style={{fontSize:'12px',marginBottom:'8px'}}>Serving size: {labelResult.servingSize || 'not specified'} · {labelResult.caloriesPerServing} cal, {labelResult.proteinPerServing}g protein, {labelResult.carbsPerServing}g carbs, {labelResult.fatPerServing}g fat per serving</div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'10px'}}>
                <label className="label" style={{margin:0,flexShrink:0}}>Servings</label>
                <input className="input" type="number" min="0" step="0.5" value={labelServings} onChange={e=>setLabelServings(e.target.value)} style={{maxWidth:'80px'}}/>
                {labelResult.servingsPerContainer && (
                  <button type="button" className="btn-ghost-sm" onClick={()=>{ setLabelServings(String(labelResult.servingsPerContainer)); addLabelToMeal(labelResult.servingsPerContainer); }}>
                    Whole Container ({labelResult.servingsPerContainer})
                  </button>
                )}
              </div>
              <button type="button" className="btn-secondary" onClick={()=>addLabelToMeal()}>Add to Meal</button>
            </div>
          )}

          <VoiceNoteButton label="Or Describe What You Ate" onTranscript={handleVoiceTranscript}/>
          {voiceLoading && <p className="muted" style={{fontSize:'12px',marginTop:'6px'}}>Working it out…</p>}
          {voiceError && <p className="form-error" style={{marginTop:'6px'}}>{voiceError}</p>}
        </div>

        {/* Running total — the number that actually gets logged */}
        <div className="glass-card" style={{textAlign:'center'}}>
          <div style={{fontSize:'32px',fontWeight:'700',color:'var(--accent)',lineHeight:1.1}}>{Math.round(liveTotals.calories)}</div>
          <div className="muted" style={{fontSize:'12px',marginBottom:'6px'}}>calories</div>
          <div style={{display:'flex',gap:'16px',justifyContent:'center',fontSize:'13px'}}>
            <span><strong>{Math.round(liveTotals.protein)}g</strong> <span className="muted">protein</span></span>
            <span><strong>{Math.round(liveTotals.carbs)}g</strong> <span className="muted">carbs</span></span>
            <span><strong>{Math.round(liveTotals.fat)}g</strong> <span className="muted">fat</span></span>
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--border)'}}>
            <label className="muted" style={{fontSize:'12px',flexShrink:0}}>How much of this did you eat?</label>
            <input className="input" type="number" min="0" max="500" value={logPercent}
              onChange={e=>updateLogPercent(e.target.value)} style={{fontSize:'13px',padding:'6px 8px',width:'70px'}}/>
            <span className="muted" style={{fontSize:'12px'}}>%</span>
          </div>
          <p className="muted" style={{fontSize:'11px',marginTop:'4px'}}>Scales calories and macros for the whole log — 200% doubles everything, 50% halves it.</p>
        </div>

        {/* Ingredient rows — each one separately editable */}
        <div className="card-form">
          <label className="label" style={{display:'block',marginBottom:'10px'}}>What did you eat?</label>
          {ingredients.map((ing, i) => (
            <div key={ing.key} style={{border:'1px solid var(--border)',borderRadius:'var(--r-sm)',padding:'10px',marginBottom:'8px'}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'8px'}}>
                <input className="input" placeholder="e.g. Grilled chicken breast" value={ing.name}
                  onChange={e=>updateIngredient(i, { name: e.target.value })} style={{flex:1}}/>
                {ingredients.length > 1 && (
                  <button type="button" className="btn-ghost-sm" onClick={()=>removeIngredient(i)} style={{flexShrink:0}}>
                    <IconTrash style={{width:'14px',height:'14px'}}/>
                  </button>
                )}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:'6px'}}>
                <input className="input" type="number" min="0" placeholder="Cal" value={ing.calories} onChange={e=>updateIngredient(i, { calories: e.target.value })} style={{fontSize:'13px',padding:'8px 10px'}}/>
                <input className="input" type="number" min="0" placeholder="Protein" value={ing.protein} onChange={e=>updateIngredient(i, { protein: e.target.value })} style={{fontSize:'13px',padding:'8px 10px'}}/>
                <input className="input" type="number" min="0" placeholder="Carbs" value={ing.carbs} onChange={e=>updateIngredient(i, { carbs: e.target.value })} style={{fontSize:'13px',padding:'8px 10px'}}/>
                <input className="input" type="number" min="0" placeholder="Fat" value={ing.fat} onChange={e=>updateIngredient(i, { fat: e.target.value })} style={{fontSize:'13px',padding:'8px 10px'}}/>
              </div>
            </div>
          ))}
          <button type="button" className="btn-ghost-sm" onClick={addIngredient} style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <IconPlus style={{width:'14px',height:'14px'}}/> Add Another Item
          </button>
        </div>

        <div className="card-form">
          <div className="field" style={{marginBottom:0}}>
            <label className="label">Notes (optional)</label>
            <input className="input" placeholder="e.g. ate out, homemade, etc." value={notes} onChange={e=>setNotes(e.target.value)}/>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editMeal ? 'Save Changes' : 'Log Meal'}</button>
      </form>

      {/* Calorie tracker for the selected day */}
      <section className="section">
        <div className="section-header">
          <span className="section-title">{date === today() ? "Today" : formatDateStr(date, {month:'long',day:'numeric'})}</span>
        </div>
        <div className="glass-card" style={{marginBottom:'16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'2px'}}>
            <span style={{fontSize:'24px',fontWeight:'700',color: overGoal ? 'var(--danger)' : 'var(--accent)'}}>{totals.calories}</span>
            <span className="muted" style={{fontSize:'13px'}}>{calorieGoal ? `of ${effectiveGoal} cal goal` : 'calories logged'}</span>
          </div>
          {totals.caloriesBurned > 0 && (
            <div className="muted" style={{fontSize:'12px',marginBottom:'10px'}}>
              {calorieGoal ? `Includes +${totals.caloriesBurned} from exercise` : `${totals.caloriesBurned} calories burned from exercise`}
            </div>
          )}
          {effectiveGoal != null && (
            <div style={{marginBottom:'14px'}}>
              <MacroProgressBar value={totals.calories} max={effectiveGoal}/>
            </div>
          )}
          {[
            { label: 'Protein', value: totals.protein, goal: macroGoals.protein, color: 'var(--teal)' },
            { label: 'Carbs',   value: totals.carbs,   goal: macroGoals.carbs,   color: 'var(--rose)' },
            { label: 'Fat',     value: totals.fat,     goal: macroGoals.fat,     color: 'var(--accent)' },
          ].map(m => (
            <div key={m.label} style={{marginBottom:'8px'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',marginBottom:'3px'}}>
                <span style={{fontWeight:'700'}}>{m.label}</span>
                <span className="muted">{Math.round(m.value)}g{m.goal ? ` / ${m.goal}g` : ''}</span>
              </div>
              {m.goal && <MacroProgressBar value={m.value} max={m.goal} color={m.color} height="6px"/>}
            </div>
          ))}
        </div>

        {loadingDay ? <div className="spinner"/> : meals.length === 0 ? (
          <p className="muted" style={{fontSize:'13px'}}>Nothing logged for this day yet.</p>
        ) : (
          MEAL_TYPES.map(type => {
            const forType = meals.filter(m => m.meal_type === type);
            if (forType.length === 0) return null;
            return (
              <div key={type} style={{marginBottom:'12px'}}>
                <div className="muted" style={{fontSize:'11px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'6px'}}>{type}</div>
                {forType.map(m => (
                  <div key={m.id} className="list-item" style={{marginBottom:'6px'}}>
                    <div style={{flex:1}}>
                      <div className="item-main">{m.name}</div>
                      <div className="item-meta">{m.calories ? `${m.calories} cal` : ''}{m.protein ? ` · ${m.protein}g protein` : ''}</div>
                    </div>
                    <button className="btn-ghost-sm" onClick={()=>removeMeal(m.id)}><IconTrash style={{width:'14px',height:'14px'}}/></button>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
