import RestrictionPicker from './RestrictionPicker';
import KitchenIllustration from './KitchenIllustration';

const GOALS = ['Cut (Lose Fat)', 'Bulk (Gain Muscle)', 'Maintain', 'Recomp'];
const ACTIVITY_LEVELS = [
  'Not Active', 'Lightly Active', 'Moderately Active', 'Pretty Active', 'Very Active', 'Super Active',
];
// Rough calories-per-lb-of-bodyweight-per-day estimate for total daily energy use at each activity level.
const ACTIVITY_MULTIPLIERS = {
  'Not Active': 12, 'Lightly Active': 13.5, 'Moderately Active': 15,
  'Pretty Active': 16.5, 'Very Active': 18, 'Super Active': 20,
};
const CALORIE_MIN = 1200; // a floor so the calculator never suggests something unsafely low
const CALORIE_MAX = 6000;

function calculateCalorieGoal(profile) {
  const weight = Number(profile.weight);
  if (!weight || weight <= 0) return null;
  const mult = ACTIVITY_MULTIPLIERS[profile.activityLevel] || ACTIVITY_MULTIPLIERS['Moderately Active'];
  const tdee = weight * mult;

  const goalWeight = Number(profile.goalWeight);
  const timeline = Number(profile.timeline);
  let adjustment = 0;
  if (goalWeight > 0 && timeline > 0) {
    const weeklyRateLbs = (goalWeight - weight) / timeline;
    adjustment = (weeklyRateLbs * 3500) / 7; // ~3500 cal per lb of bodyweight
  } else if (profile.goal === 'Cut (Lose Fat)') {
    adjustment = -500;
  } else if (profile.goal === 'Bulk (Gain Muscle)') {
    adjustment = 350;
  }

  return Math.max(CALORIE_MIN, Math.min(CALORIE_MAX, Math.round(tdee + adjustment)));
}

export { GOALS, ACTIVITY_LEVELS };

export default function ProfileForm({ profile, setProfile }) {
  return (
    <div className="form-stack">
      <div className="input-row">
        <div className="input-group">
          <label className="label">Current Weight (lbs)</label>
          <input className="input" type="number" placeholder="185" value={profile.weight || ''} onChange={e=>setProfile(p=>({...p,weight:e.target.value}))}/>
        </div>
        <div className="input-group">
          <label className="label">Goal Weight (lbs)</label>
          <input className="input" type="number" placeholder="175" value={profile.goalWeight || ''} onChange={e=>setProfile(p=>({...p,goalWeight:e.target.value}))}/>
        </div>
      </div>
      <div className="input-row">
        <div className="input-group">
          <label className="label">Goal</label>
          <select className="input" value={profile.goal || GOALS[2]} onChange={e=>setProfile(p=>({...p,goal:e.target.value}))}>
            {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label className="label">Timeline (weeks)</label>
          <input className="input" type="number" placeholder="12" value={profile.timeline || ''} onChange={e=>setProfile(p=>({...p,timeline:e.target.value}))}/>
        </div>
      </div>
      <div className="field">
        <label className="label">Activity Level</label>
        <select className="input" value={profile.activityLevel || ''} onChange={e=>setProfile(p=>({...p,activityLevel:e.target.value}))}>
          <option value="" disabled>Select one…</option>
          {ACTIVITY_LEVELS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="label">Daily Calorie Goal (optional)</label>
        <div style={{display:'flex',gap:'8px'}}>
          <input className="input" type="number" min={CALORIE_MIN} max={CALORIE_MAX} style={{flex:1}} value={profile.calorieGoal || ''} onChange={e=>setProfile(p=>({...p,calorieGoal:e.target.value}))}/>
          <button type="button" className="btn-ghost-sm" style={{flexShrink:0}} disabled={!profile.weight}
            onClick={()=>{
              const calc = calculateCalorieGoal(profile);
              if (calc != null) setProfile(p=>({...p,calorieGoal:String(calc)}));
            }}>
            Calculate for Me
          </button>
        </div>
        {!profile.weight && <p className="muted" style={{fontSize:'12px',marginTop:'4px'}}>Fill in your weight above to use the calculator.</p>}
      </div>
      <div className="field">
        <label className="label">Daily Macro Goals in grams (optional)</label>
        <div className="input-row">
          <div className="input-group">
            <label className="label" style={{fontSize:'12px'}}>Protein</label>
            <input className="input" type="number" min="0" placeholder="auto" value={profile.proteinGoal || ''} onChange={e=>setProfile(p=>({...p,proteinGoal:e.target.value}))}/>
          </div>
          <div className="input-group">
            <label className="label" style={{fontSize:'12px'}}>Carbs</label>
            <input className="input" type="number" min="0" placeholder="auto" value={profile.carbsGoal || ''} onChange={e=>setProfile(p=>({...p,carbsGoal:e.target.value}))}/>
          </div>
          <div className="input-group">
            <label className="label" style={{fontSize:'12px'}}>Fat</label>
            <input className="input" type="number" min="0" placeholder="auto" value={profile.fatGoal || ''} onChange={e=>setProfile(p=>({...p,fatGoal:e.target.value}))}/>
          </div>
        </div>
        <p className="muted" style={{fontSize:'12px',marginTop:'4px'}}>Leave blank to use a standard split (30% protein / 40% carbs / 30% fat) of your calorie goal.</p>
      </div>
      <div className="field">
        <label className="label">Palm Width (optional)</label>
        <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
          <input className="input" type="number" step="0.1" style={{flex:1}}
            placeholder={profile.palmWidthUnit === 'cm' ? 'e.g. 8.9' : 'e.g. 3.5'}
            value={
              profile.palmWidth
                ? (profile.palmWidthUnit === 'cm' ? (Number(profile.palmWidth) * 2.54).toFixed(1) : profile.palmWidth)
                : ''
            }
            onChange={e => {
              const raw = e.target.value;
              const inches = raw === '' ? '' : (profile.palmWidthUnit === 'cm' ? (Number(raw) / 2.54).toFixed(2) : raw);
              setProfile(p => ({ ...p, palmWidth: inches }));
            }}
          />
          <div className="tab-row" style={{flexShrink:0,width:'auto'}}>
            <button type="button" className={profile.palmWidthUnit !== 'cm' ? 'tab active' : 'tab'} onClick={()=>setProfile(p=>({...p,palmWidthUnit:'in'}))}>in</button>
            <button type="button" className={profile.palmWidthUnit === 'cm' ? 'tab active' : 'tab'} onClick={()=>setProfile(p=>({...p,palmWidthUnit:'cm'}))}>cm</button>
          </div>
        </div>
        <p className="muted" style={{fontSize:'12px'}}>Measured straight across your palm, not including your thumb. See the illustration on the meal photo scan screen for exactly where to measure. Used to help the AI judge portion sizes when you scan a food photo with your hand in frame.</p>
      </div>
      <div className="field">
        <label className="label">Dietary Restrictions</label>
        <RestrictionPicker value={Array.isArray(profile.restrictions) ? profile.restrictions : []} onChange={r=>setProfile(p=>({...p,restrictions:r}))}/>
      </div>
      <div className="field">
        <label className="label">Foods You Dislike</label>
        <input className="input" placeholder="e.g. mushrooms, cilantro" value={profile.dislikes || ''} onChange={e=>setProfile(p=>({...p,dislikes:e.target.value}))}/>
      </div>
      <div className="field">
        <label className="label">Foods You Really Want</label>
        <input className="input" placeholder="e.g. salmon, sweet potatoes" value={profile.wantedFoods || ''} onChange={e=>setProfile(p=>({...p,wantedFoods:e.target.value}))}/>
      </div>
      <div className="field">
        <label className="label">Kitchen Appliances</label>
        <KitchenIllustration selected={Array.isArray(profile.appliances) ? profile.appliances : []} onChange={v=>setProfile(p=>({...p,appliances:v}))}/>
      </div>
      <div className="field">
        <label className="label">Notes for the AI (goals, injuries, preferences)</label>
        <textarea className="input" rows={3} placeholder="e.g. bad left knee, training for a 5K, cooking for one" value={profile.notes || ''} onChange={e=>setProfile(p=>({...p,notes:e.target.value}))} />
      </div>
    </div>
  );
}
