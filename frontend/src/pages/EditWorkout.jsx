import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import WorkoutForm from '../components/WorkoutForm';
import WorkoutPhotos from '../components/WorkoutPhotos';
import { ALL_CARDIO_NAMES } from '../data/exercises';

function toFormInitial(workout) {
  return {
    name: workout.name || '',
    date: workout.date ? String(workout.date).slice(0, 10) : '',
    notesBefore: workout.notes_before || '',
    notesAfter: workout.notes_after || '',
    exercises: (workout.exercises || []).map(e => {
      if (e.category === 'lifting') {
        return {
          category: 'lifting',
          exerciseName: e.exercise_name,
          notes: e.notes || '',
          sets: e.sets ?? '',
          reps: e.reps ?? '',
          weight: e.weight ?? '',
          perSetWeights: !!e.per_set_weights,
          setsData: (e.sets_data || []).map(s => ({ reps: s.reps ?? '', weight: s.weight ?? '' })),
        };
      }
      const known = ALL_CARDIO_NAMES.includes(e.exercise_name);
      return {
        category: 'cardio',
        exerciseName: known ? e.exercise_name : 'Other',
        customName: known ? '' : e.exercise_name,
        notes: e.notes || '',
        durationMinutes: e.duration_minutes ?? '',
        distance: e.distance ?? '',
        distanceUnit: e.distance_unit || 'mi',
        calories: e.calories ?? '',
        avgHeartRate: e.avg_heart_rate ?? '',
        pace: e.pace || '',
        intensity: e.intensity || '',
      };
    }),
  };
}

export default function EditWorkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.getWorkout(id)
      .then(w => setInitial(toFormInitial(w)))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!window.confirm('Delete this workout? This cannot be undone.')) return;
    try {
      await api.deleteWorkout(id);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (error && !initial) return <div className="page"><p className="form-error">{error}</p></div>;

  return (
    <div className="page">
      <h2 className="page-title">Edit Workout</h2>
      {/* The multi-photo uploader lives here, before the Save Changes / Delete
          Workout buttons inside the form below — it's the one and only place
          to add photos to this workout now. */}
      {initial && <WorkoutPhotos workoutId={id} date={initial.date} />}
      <div className="card-form">
        <WorkoutForm
          mode="edit"
          initial={initial}
          onSubmit={(payload) => api.updateWorkout(id, payload)}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
