import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDateStr } from '../dateUtils';
import { formatCompact } from '../format';
import { displayWeight, weightUnitLabel } from '../units';
import { closestComparison } from '../weightComparisons';
import ProgressChart from '../components/ProgressChart';
import FireIcon from '../components/StreakFire';
import { IconChevron, IconCamera } from '../components/Icons';
import PersonalGoals from '../components/PersonalGoals';

export default function ProgressPhotos() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  const [exerciseList, setExerciseList] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [stats, setStats] = useState({ workouts: 0, prs: 0, streak: 0, volume: 0 });
  const [showCompare, setShowCompare] = useState(false);
  const [showStrength, setShowStrength] = useState(false);
  const [showVolumeFact, setShowVolumeFact] = useState(false);

  useEffect(() => {
    api.getPhotos().then(setPhotos).catch(console.error).finally(() => setLoadingPhotos(false));
    api.getLoggedExercises().then(list => {
      setExerciseList(list);
      if (list.length > 0) setSelectedExercise(list[0]);
    }).catch(console.error);
    Promise.all([
      api.getWorkouts().catch(() => []),
      api.getPRs().catch(() => []),
      api.getStreak().catch(() => ({ streak: 0 })),
      api.getVolume().catch(() => ({ volume: 0 })),
    ]).then(([w, p, s, v]) => setStats({ workouts: w.length, prs: p.length, streak: s.streak || 0, volume: v.volume || 0 }));
  }, []);

  useEffect(() => {
    if (!selectedExercise) return;
    setLoadingHistory(true);
    api.getExerciseHistory(selectedExercise)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [selectedExercise]);

  const recentPhotos = photos.slice(0, 6);
  const oldest = photos[photos.length - 1];
  const newest = photos[0];

  return (
    <div className="page">
      <h2 className="page-title">Progress</h2>

      {/* Quick stats */}
      <div className="stat-row" style={{marginBottom:'24px'}}>
        <Link to="/log/history" className="stat-card" style={{textDecoration:'none',color:'inherit',cursor:'pointer'}}>
          <span className="stat-num">{stats.workouts}</span>
          <span className="stat-label">Workouts</span>
        </Link>
        <div className="stat-card" style={{cursor:'pointer'}} onClick={()=>setShowStrength(s=>!s)}>
          <span className="stat-num">{stats.prs}</span>
          <span className="stat-label">PRs Set</span>
        </div>
        <div className="stat-card">
          <span className="stat-num" style={{display:'flex',alignItems:'center',gap:'4px',justifyContent:'center'}}>
            {stats.streak}{stats.streak > 0 && <FireIcon size={18}/>}
          </span>
          <span className="stat-label">Day Streak</span>
        </div>
        <div className="stat-card" style={{cursor:'pointer'}} onClick={()=>setShowVolumeFact(true)}>
          <span className="stat-num">{formatCompact(displayWeight(stats.volume, user?.weightUnit))}</span>
          <span className="stat-label">Total {weightUnitLabel(user?.weightUnit)} Lifted</span>
        </div>
      </div>

      {showVolumeFact && createPortal(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,.55)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={()=>setShowVolumeFact(false)}>
          <div style={{width:'100%',maxWidth:'360px',borderRadius:'16px',background:'var(--surface)',padding:'22px 20px',boxShadow:'var(--shadow-lg)',textAlign:'center'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{marginBottom:'10px'}}>Total Weight Lifted</h3>
            {(() => {
              const ref = closestComparison(stats.volume);
              return ref ? (
                <p className="muted" style={{fontSize:'14px',marginBottom:'18px',lineHeight:'1.5'}}>
                  You've lifted {formatCompact(displayWeight(stats.volume, user?.weightUnit))} {weightUnitLabel(user?.weightUnit)} all-time — that's about the same as {ref.name}!
                </p>
              ) : (
                <p className="muted" style={{fontSize:'14px',marginBottom:'18px'}}>Log a few workouts to see a fun comparison here.</p>
              );
            })()}
            <button className="btn-primary" style={{width:'100%'}} onClick={()=>setShowVolumeFact(false)}>Got It</button>
          </div>
        </div>,
        document.body
      )}

      {/* Photos preview */}
      <section className="section">
        <div className="section-header">
          <span className="section-title">Progress Photos</span>
          <Link to="/photos/all" className="link-small">See All →</Link>
        </div>
        {loadingPhotos ? <div className="spinner"/> : photos.length === 0 ? (
          <p className="muted" style={{fontSize:'13px'}}>No photos yet. <Link to="/photos/all">Upload your first!</Link></p>
        ) : (
          <div style={{display:'flex',gap:'8px',overflowX:'auto',paddingBottom:'4px'}}>
            {recentPhotos.map(ph => (
              <Link to="/photos/all" key={ph.id} style={{flexShrink:0}}>
                <img src={api.fileUrl(ph.file_path)} alt={ph.photo_date} style={{width:'88px',height:'88px',objectFit:'cover',borderRadius:'var(--r)',border:'1px solid var(--border)'}}/>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Strength progress chart — shown when the "PRs Set" stat card above is tapped */}
      {showStrength && (
        <section className="section">
          <div className="section-header">
            <span className="section-title">Strength Progress</span>
          </div>
          {exerciseList.length === 0 ? (
            <p className="muted" style={{fontSize:'13px'}}>Log a few lifting workouts to see your progress here.</p>
          ) : (
            <div className="card-form">
              <select className="input" value={selectedExercise} onChange={e=>setSelectedExercise(e.target.value)} style={{marginBottom:'14px'}}>
                {exerciseList.map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>
              {loadingHistory ? <div className="spinner"/> : <ProgressChart points={history || []} unit={user?.weightUnit || 'lbs'} />}
            </div>
          )}
        </section>
      )}

      {/* Before & After comparison */}
      {photos.length >= 2 && (
        <section className="section">
          <div className="list-item clickable" onClick={()=>setShowCompare(s=>!s)} style={{marginBottom: showCompare ? '12px' : 0}}>
            <IconCamera style={{width:'20px',height:'20px',color:'var(--accent)',flexShrink:0}}/>
            <div style={{flex:1}}>
              <div className="item-main">Before & After</div>
              <div className="item-meta">Compare your first and most recent photo</div>
            </div>
            <IconChevron style={{width:'16px',height:'16px',color:'var(--muted)',transform: showCompare ? 'rotate(90deg)' : 'none'}}/>
          </div>
          {showCompare && (
            <div style={{display:'flex',gap:'10px'}}>
              <div style={{flex:1,textAlign:'center'}}>
                <img src={api.fileUrl(oldest.file_path)} alt="before" style={{width:'100%',aspectRatio:'3/4',objectFit:'cover',borderRadius:'var(--r)',border:'1px solid var(--border)'}}/>
                <p className="muted" style={{fontSize:'12px',marginTop:'6px'}}>{formatDateStr(oldest.photo_date)}</p>
              </div>
              <div style={{flex:1,textAlign:'center'}}>
                <img src={api.fileUrl(newest.file_path)} alt="after" style={{width:'100%',aspectRatio:'3/4',objectFit:'cover',borderRadius:'var(--r)',border:'1px solid var(--border)'}}/>
                <p className="muted" style={{fontSize:'12px',marginTop:'6px'}}>{formatDateStr(newest.photo_date)}</p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Personal Goals — moved here from Challenges since it's an individual, not social, feature */}
      <PersonalGoals />
    </div>
  );
}
