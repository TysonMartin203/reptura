import { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Header     from './components/Header';
import Nav        from './components/Nav';
import Home       from './pages/Home';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import Tutorial   from './pages/Tutorial';
import Admin       from './pages/Admin';
import Dashboard  from './pages/Dashboard';
import LogWorkout from './pages/LogWorkout';
import WorkoutsHub from './pages/WorkoutsHub';
import PastWorkouts from './pages/PastWorkouts';
const RunTracker = lazy(() => import('./pages/RunTracker'));
import EditWorkout from './pages/EditWorkout';
import ViewWorkout from './pages/ViewWorkout';
import WorkoutPlans from './pages/WorkoutPlans';
import Photos     from './pages/ProgressPhotos';
import AllPhotos  from './pages/AllPhotos';
import Feed       from './pages/Feed';
import Social     from './pages/Social';
import ProfileView from './pages/ProfileView';
import Settings   from './pages/Settings';
import AccountSettings from './pages/AccountSettings';
import Meals      from './pages/Meals';
import MealsHub   from './pages/MealsHub';
import LogMeal    from './pages/LogMeal';
import MealHistory from './pages/MealHistory';
import CalorieTracker from './pages/CalorieTracker';

function Private({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"          element={<Home />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword />} />
      <Route path="/tutorial"  element={<Private><Tutorial /></Private>} />
      <Route path="/admin"     element={<Private><Admin /></Private>} />
      <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
      <Route path="/log"       element={<Private><WorkoutsHub /></Private>} />
      <Route path="/log/new"   element={<Private><LogWorkout /></Private>} />
      <Route path="/log/history" element={<Private><PastWorkouts /></Private>} />
      <Route path="/log/track" element={<Private><Suspense fallback={<div className="page"><div className="spinner"/></div>}><RunTracker /></Suspense></Private>} />
      <Route path="/workout-plans" element={<Private><WorkoutPlans /></Private>} />
      <Route path="/workouts/:id" element={<Private><EditWorkout /></Private>} />
      <Route path="/workouts/:id/view" element={<Private><ViewWorkout /></Private>} />
      <Route path="/photos"    element={<Private><Photos /></Private>} />
      <Route path="/photos/all" element={<Private><AllPhotos /></Private>} />
      <Route path="/feed"      element={<Private><Feed /></Private>} />
      <Route path="/social"    element={<Private><Social /></Private>} />
      <Route path="/profile/:id" element={<Private><ProfileView /></Private>} />
      <Route path="/settings"  element={<Private><Settings /></Private>} />
      <Route path="/account"   element={<Private><AccountSettings /></Private>} />
      <Route path="/meals"     element={<Private><MealsHub /></Private>} />
      <Route path="/meals/plans" element={<Private><Meals /></Private>} />
      <Route path="/meals/log" element={<Private><LogMeal /></Private>} />
      <Route path="/meals/history" element={<Private><MealHistory /></Private>} />
      <Route path="/meals/calories" element={<Private><CalorieTracker /></Private>} />
    </Routes>
  );
}

export default function App() {
  const { user } = useAuth();

  useEffect(() => {
    const dark = user?.theme === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#262840' : '#E07A5F');
  }, [user?.theme]);

  if (!user) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="*" element={<Home />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <Nav />
      <div className="desktop-main">
        <Header />
        <div className="app-content">
          <AppRoutes />
        </div>
      </div>
    </div>
  );
}
