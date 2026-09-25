import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { today } from '../dateUtils';
import { IconTrash } from '../components/Icons';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SPORT_LABEL = { run: 'Run', bike: 'Bike', swim: 'Swim', brick: 'Brick', strength: 'Strength', race: 'Race' };
const SPORT_TO_CARDIO = { run: 'Running', bike: 'Biking', swim: 'Swimming' };

// Calendar-day helpers in UTC, matching the backend, so a session's date is
// never shifted by the device's timezone.
const parseDay = s => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const mondayOf = d => addDays(d, -((d.getUTCDay() + 6) % 7));
const shortDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function sessionDate(startDate, week, day) {
  return addDays(mondayOf(parseDay(startDate)), (week - 1) * 7 + DAYS.indexOf(day));
}

export default function RaceTraining() {
  const [view, setView] = useState('list'); // list | new | detail
  const [activeId, setActiveId] = useState(null);

  if (view === 'new') return <NewRacePlan onCancel={() => setView('list')} onCreated={id => { setActiveId(id); setView('detail'); }} />;
  if (view === 'detail' && activeId) return <RacePlanDetail id={activeId} onBack={() => setView('list')} />;
  return <RacePlanList onNew={() => setView('new')} onOpen={id => { setActiveId(id); setView('detail'); }} />;
}

function RacePlanList({ onNew, onOpen }) {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getRacePlans().then(d => setPlans(d.plans || [])).catch(err => { setError(err.message); setPlans([]); });
  }, []);

  async function remove(e, id) {
    e.stopPropagation();
    if (!window.confirm('Delete this race plan?')) return;
    setPlans(p => p.filter(x => x.id !== id));
    api.deleteRacePlan(id).catch(err => setError(err.message));
  }

  const todayDay = parseDay(today());
  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Race Training</h2>
        <Link to="/log" className="link-small">← Workouts</Link>
      </div>
      <button className="btn-primary" style={{ marginBottom: '20px' }} onClick={onNew}>+ New Race Plan</button>
      {error && <p className="form-error">{error}</p>}
      {plans === null ? <div className="spinner" /> : plans.length === 0 ? (
        <p className="muted" style={{ fontSize: '13px' }}>No race plans yet. Pick a race and a date, and you'll get a week-by-week plan that builds you up to race day.</p>
      ) : (
        <div className="form-stack">
          {plans.map(p => {
            const daysLeft = Math.round((parseDay(p.race_date) - todayDay) / 86400000);
            return (
              <div key={p.id} className="glass-card" style={{ cursor: 'pointer' }} onClick={() => onOpen(p.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '3px' }}>{p.race_name || p.race_type}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {p.race_name ? `${p.race_type} · ` : ''}{shortDate(parseDay(p.race_date))}
                      {' · '}{daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} to go` : daysLeft === 0 ? 'Race day!' : 'Completed'}
                    </div>
                  </div>
                  <button onClick={e => remove(e, p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}>
                    <IconTrash style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewRacePlan({ onCancel, onCreated }) {
  const { user } = useAuth();
  const unit = user?.distanceUnit === 'km' ? 'km' : 'mi';
  const [races, setRaces] = useState([]);
  const [form, setForm] = useState({ raceType: '', raceName: '', startDate: today(), raceDate: '' });
  const [fit, setFit] = useState({ experience: 'Beginner', daysPerWeek: 4, longDay: 'Sat', goalType: 'Finish' });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getRaceOptions().then(d => setRaces(d.races || [])).catch(err => setError(err.message));
    // Prefill from the answers they gave last time (saved to their profile).
    api.getProfile().then(d => { if (d.profile?.raceFitness) setFit(f => ({ ...f, ...d.profile.raceFitness })); }).catch(() => {});
  }, []);

  const race = races.find(r => r.name === form.raceType);
  const has = s => race?.disciplines.includes(s);
  const setF = (k, v) => setFit(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setGenerating(true);
    try {
      const { id } = await api.createRacePlan({ ...form, distanceUnit: unit, fitness: fit });
      onCreated(id);
    } catch (err) { setError(err.message); }
    finally { setGenerating(false); }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>New Race Plan</h2>
        <button type="button" className="link-small" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={onCancel}>← Back</button>
      </div>
      <form onSubmit={submit} className="form-stack">
        <div className="card-form">
          <div className="field">
            <label className="label">Race</label>
            <select className="input" value={form.raceType} onChange={e => setForm(f => ({ ...f, raceType: e.target.value }))} required>
              <option value="" disabled>Choose a race</option>
              {races.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
            {race && <p className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>Most plans for this run about {race.typicalWeeks} weeks.</p>}
          </div>
          <div className="field">
            <label className="label">Race name (optional)</label>
            <input className="input" placeholder="e.g. Chicago Marathon" value={form.raceName} onChange={e => setForm(f => ({ ...f, raceName: e.target.value }))} />
          </div>
          <div className="input-row">
            <div className="input-group"><label className="label">Start training</label>
              <input className="input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required /></div>
            <div className="input-group"><label className="label">Race day</label>
              <input className="input" type="date" value={form.raceDate} onChange={e => setForm(f => ({ ...f, raceDate: e.target.value }))} required /></div>
          </div>
        </div>

        <div className="card-form">
          <label className="label" style={{ display: 'block', marginBottom: '10px' }}>Where you're starting from</label>
          <div className="input-row">
            <div className="input-group"><label className="label">Experience</label>
              <select className="input" value={fit.experience} onChange={e => setF('experience', e.target.value)}>
                {['Beginner', 'Intermediate', 'Advanced'].map(x => <option key={x}>{x}</option>)}
              </select></div>
            <div className="input-group"><label className="label">Days/week</label>
              <select className="input" value={fit.daysPerWeek} onChange={e => setF('daysPerWeek', Number(e.target.value))}>
                {/* 0 means "no set number" — the coach picks the frequency rather
                    than the plan coming back empty. */}
                <option value={0}>Let coach decide</option>
                {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
              </select></div>
            <div className="input-group"><label className="label">Long day</label>
              <select className="input" value={fit.longDay} onChange={e => setF('longDay', e.target.value)}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select></div>
          </div>
          <div className="input-row">
            <div className="input-group"><label className="label">Goal</label>
              <select className="input" value={fit.goalType} onChange={e => setF('goalType', e.target.value)}>
                <option>Finish</option><option>Time goal</option>
              </select></div>
            {fit.goalType === 'Time goal' && (
              <div className="input-group"><label className="label">Goal time</label>
                <input className="input" placeholder="e.g. 1:55:00" value={fit.goalTime || ''} onChange={e => setF('goalTime', e.target.value)} /></div>
            )}
          </div>

          {has('run') && (
            <div className="input-row">
              <div className="input-group"><label className="label">Running now ({unit}/wk)</label>
                <input className="input" type="number" min="0" value={fit.runWeekly || ''} onChange={e => setF('runWeekly', e.target.value)} /></div>
              <div className="input-group"><label className="label">Longest recent run ({unit})</label>
                <input className="input" type="number" min="0" value={fit.runLongest || ''} onChange={e => setF('runLongest', e.target.value)} /></div>
            </div>
          )}
          {has('bike') && (
            <div className="input-row">
              <div className="input-group"><label className="label">Riding now ({unit}/wk)</label>
                <input className="input" type="number" min="0" value={fit.bikeWeekly || ''} onChange={e => setF('bikeWeekly', e.target.value)} /></div>
              <div className="input-group"><label className="label">Longest recent ride ({unit})</label>
                <input className="input" type="number" min="0" value={fit.bikeLongest || ''} onChange={e => setF('bikeLongest', e.target.value)} /></div>
            </div>
          )}
          {has('swim') && (
            <div className="input-row">
              <div className="input-group"><label className="label">Swimming</label>
                <select className="input" value={fit.swimComfort || ''} onChange={e => setF('swimComfort', e.target.value)}>
                  <option value="">Choose one</option>
                  <option>Can't swim freestyle yet</option>
                  <option>Can swim laps slowly</option>
                  <option>Comfortable swimming laps</option>
                </select></div>
              <div className="input-group"><label className="label">Longest swim ({unit === 'km' ? 'm' : 'yd'})</label>
                <input className="input" type="number" min="0" value={fit.swimLongest || ''} onChange={e => setF('swimLongest', e.target.value)} /></div>
            </div>
          )}
          <div className="field">
            <label className="label">Recent race result (optional)</label>
            <input className="input" placeholder="e.g. 5K in 28:30" value={fit.recentRace || ''} onChange={e => setF('recentRace', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Injuries or anything else (optional)</label>
            <textarea className="input" rows={2} value={fit.notes || ''} onChange={e => setF('notes', e.target.value)} />
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={generating}>
          {generating ? 'Building your plan…' : 'Build My Plan'}
        </button>
        {generating && <p className="muted" style={{ fontSize: '12px', textAlign: 'center' }}>Longer races like an Ironman can take a couple of minutes — keep this screen open.</p>}
      </form>
    </div>
  );
}

function RacePlanDetail({ id, onBack }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openWeeks, setOpenWeeks] = useState(new Set());
  const currentRef = useRef(null);

  const todayDay = parseDay(today());

  useEffect(() => {
    api.getRacePlan(id).then(d => {
      setData(d.plan);
      // Open the current week (or week 1 if training hasn't started yet).
      const start = mondayOf(parseDay(d.plan.start_date));
      const wk = Math.floor((todayDay - start) / (7 * 86400000)) + 1;
      const total = d.plan.plan.weeks.length;
      setOpenWeeks(new Set([Math.min(Math.max(wk, 1), total)]));
    }).catch(err => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [data]);

  function logSession(s, date) {
    const [day, sport, title, detail, minutes] = s;
    const cardio = name => ({
      category: 'cardio', exerciseName: name, customName: '', notes: detail || '',
      durationMinutes: sport === 'brick' || sport === 'race' ? '' : String(minutes || ''),
      distance: '', distanceUnit: user?.distanceUnit || 'mi', calories: '', avgHeartRate: '', pace: '', intensity: 'Moderate',
    });
    let exercises;
    if (SPORT_TO_CARDIO[sport]) exercises = [cardio(SPORT_TO_CARDIO[sport])];
    else if (sport === 'brick') exercises = [cardio('Biking'), cardio('Running')];
    else if (sport === 'race') {
      const disc = data.race_type.includes('Triathlon') || data.race_type.includes('Ironman') ? ['Swimming', 'Biking', 'Running']
        : data.race_type.includes('Ride') || data.race_type.includes('Century') ? ['Biking']
        : data.race_type.includes('Swim') ? ['Swimming'] : ['Running'];
      exercises = disc.map(cardio);
    }
    navigate('/log/new', { state: {
      initialExercises: exercises,
      planLabel: `${data.race_name || data.race_type} · Week ${date.w}, ${day} — ${title}`,
    } });
  }

  if (error) return <div className="page"><p className="form-error">{error}</p></div>;
  if (!data) return <div className="page"><div className="spinner" /></div>;

  const daysLeft = Math.round((parseDay(data.race_date) - todayDay) / 86400000);
  const weeks = data.plan.weeks || [];

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>{data.race_name || data.race_type}</h2>
        <button type="button" className="link-small" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={onBack}>← Plans</button>
      </div>
      <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
        {data.race_name ? `${data.race_type} · ` : ''}{shortDate(parseDay(data.race_date))}
        {' · '}<strong style={{ color: 'var(--accent)' }}>{daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} to go` : daysLeft === 0 ? 'Race day!' : 'Completed'}</strong>
      </p>
      {data.plan.summary && <div className="glass-card" style={{ fontSize: '13px', marginBottom: '12px' }}>{data.plan.summary}</div>}
      {data.plan.cappedNote && <p className="muted" style={{ fontSize: '12px', marginBottom: '12px' }}>{data.plan.cappedNote}</p>}

      <div className="form-stack">
        {weeks.map(week => {
          const weekStart = sessionDate(data.start_date, week.w, 'Mon');
          const weekEnd = addDays(weekStart, 6);
          const isCurrent = todayDay >= weekStart && todayDay <= weekEnd;
          const isOpen = openWeeks.has(week.w);
          const sessions = [...(week.s || [])].sort((a, b) => DAYS.indexOf(a[0]) - DAYS.indexOf(b[0]));
          const totalMin = sessions.reduce((t, s) => t + (Number(s[4]) || 0), 0);
          return (
            <div key={week.w} ref={isCurrent ? currentRef : null} className="card-form"
              style={{ border: isCurrent ? '1.5px solid var(--accent)' : undefined, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setOpenWeeks(s => { const n = new Set(s); n.has(week.w) ? n.delete(week.w) : n.add(week.w); return n; })}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>
                    Week {week.w} <span style={{ color: 'var(--teal)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em', marginLeft: '6px' }}>{week.phase}</span>
                    {isCurrent && <span style={{ color: 'var(--accent)', fontSize: '11px', marginLeft: '6px' }}>THIS WEEK</span>}
                  </div>
                  <div className="muted" style={{ fontSize: '12px' }}>
                    {shortDate(weekStart)} – {shortDate(weekEnd)}{week.focus ? ` · ${week.focus}` : ''}{totalMin ? ` · ${Math.round(totalMin / 6) / 10} hrs` : ''}
                  </div>
                </div>
                <span className="muted" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
              </div>

              {isOpen && (
                <div style={{ marginTop: '10px' }}>
                  {sessions.map((s, i) => {
                    const date = sessionDate(data.start_date, week.w, s[0]);
                    const past = date < todayDay;
                    const isToday = date.getTime() === todayDay.getTime();
                    return (
                      <div key={i} className="list-item" style={{ opacity: past ? 0.55 : 1, marginBottom: '6px', background: isToday ? 'rgba(224,122,95,0.08)' : undefined }}>
                        <div style={{ width: '46px', flexShrink: 0, fontSize: '11px', color: 'var(--muted)', lineHeight: 1.3 }}>
                          <div style={{ fontWeight: '700', color: isToday ? 'var(--accent)' : 'var(--text)' }}>{s[0]}</div>{shortDate(date)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="item-main">
                            {s[2]} <span style={{ color: 'var(--teal)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{SPORT_LABEL[s[1]] || s[1]}</span>
                          </div>
                          <div className="item-meta">{s[3]}{s[4] ? ` · ${s[4]} min` : ''}</div>
                        </div>
                        <button type="button" className="btn-ghost-sm" style={{ flexShrink: 0 }} onClick={() => logSession(s, { w: week.w })}>Log</button>
                      </div>
                    );
                  })}
                  {sessions.length < 7 && <p className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>Days not listed are rest days.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
