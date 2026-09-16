import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { formatDateStr, today } from '../dateUtils';
import { IconChevron, IconTrash } from '../components/Icons';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export default function MealHistory() {
  const navigate = useNavigate();
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [movingKey, setMovingKey] = useState(null); // `${mealId}:${index}` while its move picker is open
  const [moveDate, setMoveDate] = useState(today());
  const [moveMealType, setMoveMealType] = useState('Breakfast');

  useEffect(() => {
    load();
  }, []);

  function load() {
    api.getMealLogHistory()
      .then(setMeals)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function remove(id) {
    setMeals(m => m.filter(x => x.id !== id));
    try { await api.deleteLoggedMeal(id); } catch {}
  }

  function edit(meal) {
    navigate('/meals/log', { state: { editMeal: meal } });
  }

  async function deleteIngredient(mealId, index) {
    try {
      await api.deleteIngredient(mealId, index);
      load();
    } catch (err) { setError(err.message); }
  }

  async function confirmMove(mealId, index) {
    try {
      await api.moveIngredient(mealId, index, { date: moveDate, mealType: moveMealType });
      setMovingKey(null);
      load();
    } catch (err) { setError(err.message); }
  }

  // Group by date for a cleaner read
  const byDate = meals.reduce((acc, m) => {
    (acc[m.date] = acc[m.date] || []).push(m);
    return acc;
  }, {});

  return (
    <div className="page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h2 className="page-title" style={{marginBottom:0}}>Meal History</h2>
        <Link to="/meals" className="link-small">← Meals</Link>
      </div>
      {error && <p className="form-error" style={{marginBottom:'12px'}}>{error}</p>}

      {loading ? <div className="spinner"/> : meals.length === 0 ? (
        <p className="muted">No meals logged yet. <Link to="/meals/log">Log your first!</Link></p>
      ) : (
        Object.entries(byDate).map(([date, dayMeals]) => (
          <div key={date} style={{marginBottom:'18px'}}>
            <div className="muted" style={{fontSize:'12px',fontWeight:'700',marginBottom:'6px'}}>{formatDateStr(date, {month:'long',day:'numeric',year:'numeric'})}</div>
            {dayMeals.map(m => {
              const ingredients = m.ingredients?.length ? m.ingredients : [{ name: m.name, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat }];
              const isExpanded = expandedId === m.id;
              return (
                <div key={m.id} className="glass-card" style={{marginBottom:'6px',padding:'0'}}>
                  <div className="list-item clickable" onClick={()=>setExpandedId(isExpanded ? null : m.id)}>
                    <div style={{flex:1}}>
                      <div className="item-main">{m.name}</div>
                      <div className="item-meta">{m.meal_type}{m.calories ? ` · ${m.calories} cal` : ''}{ingredients.length > 1 ? ` · ${ingredients.length} items` : ''}</div>
                    </div>
                    <button className="btn-ghost-sm" onClick={(e)=>{e.stopPropagation(); edit(m);}} style={{marginRight:'4px'}}>Edit</button>
                    <button className="btn-ghost-sm" onClick={(e)=>{e.stopPropagation(); remove(m.id);}} style={{marginRight:'4px'}}>Delete</button>
                    <IconChevron style={{width:'14px',height:'14px',color:'var(--muted)',transform: isExpanded ? 'rotate(90deg)' : 'none',flexShrink:0}}/>
                  </div>

                  {isExpanded && (
                    <div style={{padding:'0 12px 10px 12px',borderTop:'1px solid var(--border)'}}>
                      <p className="muted" style={{fontSize:'11px',margin:'8px 0'}}>Individual items — delete or move just one without touching the rest of this meal.</p>
                      {ingredients.map((ing, i) => {
                        const key = `${m.id}:${i}`;
                        return (
                          <div key={i} style={{marginBottom:'8px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                              <div style={{flex:1}}>
                                <div style={{fontSize:'13px'}}>{ing.name}</div>
                                {ing.calories != null && <div className="muted" style={{fontSize:'11px'}}>{ing.calories} cal</div>}
                              </div>
                              <button className="btn-ghost-sm" onClick={()=>setMovingKey(movingKey===key ? null : key)} style={{fontSize:'11px'}}>Move</button>
                              <button className="btn-ghost-sm" onClick={()=>deleteIngredient(m.id, i)} style={{fontSize:'11px'}}><IconTrash style={{width:'12px',height:'12px'}}/></button>
                            </div>
                            {movingKey === key && (
                              <div style={{display:'flex',gap:'6px',marginTop:'6px',flexWrap:'wrap',alignItems:'center'}}>
                                <input className="input" type="date" value={moveDate} onChange={e=>setMoveDate(e.target.value)} style={{fontSize:'12px',padding:'6px 8px',flex:'1 1 130px'}}/>
                                <select className="input" value={moveMealType} onChange={e=>setMoveMealType(e.target.value)} style={{fontSize:'12px',padding:'6px 8px',flex:'1 1 100px'}}>
                                  {MEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <button className="btn-accent-sm" onClick={()=>confirmMove(m.id, i)}>Move</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
