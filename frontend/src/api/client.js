const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
function getToken() { return localStorage.getItem('fittrack_token'); }

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body != null ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  return data;
}

async function uploadFile(path, formData, method = 'POST') {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

function workoutFormData(payload, photoFile) {
  const fd = new FormData();
  fd.append('data', JSON.stringify(payload));
  if (photoFile) fd.append('photo', photoFile);
  return fd;
}

export const api = {
  register:      (b) => request('POST', '/api/auth/register', b),
  login:         (b) => request('POST', '/api/auth/login', b),
  googleAuth:    (credential) => request('POST', '/api/auth/google', { credential }),
  forgotPassword: (email) => request('POST', '/api/auth/forgot-password', { email }),
  resetPassword: (token, password) => request('POST', '/api/auth/reset-password', { token, password }),
  completeTutorial: () => request('POST', '/api/auth/tutorial-done', {}),
  changePassword: (b) => request('PUT', '/api/auth/change-password', b),
  changeEmail: (b) => request('PUT', '/api/auth/change-email', b),
  changeUsername: (b) => request('PUT', '/api/auth/change-username', b),
  adminListUsers: () => request('GET', '/api/admin/users'),
  adminCreateUser: (b) => request('POST', '/api/admin/users', b),
  adminDeleteUser: (id) => request('DELETE', `/api/admin/users/${id}`),
  adminResetPassword: (id) => request('POST', `/api/admin/users/${id}/reset-password`, {}),
  adminUserWorkouts: (id) => request('GET', `/api/admin/users/${id}/workouts`),
  adminListCrews: () => request('GET', '/api/admin/crews'),
  uploadAvatar:  (fd) => uploadFile('/api/auth/avatar', fd),
  updateTheme:   (theme) => request('PUT', '/api/auth/theme', { theme }),
  updateAccountSettings: (b) => request('PUT', '/api/auth/settings', b),
  getUserProfile: (id) => request('GET', `/api/users/${id}/profile`),

  logWorkout:    (payload, photoFile) => uploadFile('/api/workouts', workoutFormData(payload, photoFile)),
  parseWorkoutVoice: (b) => request('POST', '/api/workouts/parse-voice', b),
  updateWorkout: (id, payload, photoFile) => uploadFile(`/api/workouts/${id}`, workoutFormData(payload, photoFile), 'PUT'),
  getWorkouts:   ()   => request('GET',    '/api/workouts'),
  getWorkout:    (id) => request('GET',    `/api/workouts/${id}`),
  getWorkoutView: (id) => request('GET',   `/api/workouts/${id}/view`),
  removeWorkoutPhoto: (id, keep) => request('DELETE', `/api/workouts/${id}/photo?keep=${keep}`),
  deleteWorkout: (id) => request('DELETE', `/api/workouts/${id}`),

  getPRs: () => request('GET', '/api/prs'),
  getLoggedExercises: () => request('GET', '/api/prs/exercises'),
  getExerciseHistory: (exercise) => request('GET', `/api/prs/history/${encodeURIComponent(exercise)}`),

  uploadPhoto: (fd) => uploadFile('/api/photos', fd),
  getPhotos:   ()   => request('GET',    '/api/photos'),
  getPhotosForWorkout: (workoutId) => request('GET', `/api/photos/workout/${workoutId}`),
  deletePhoto: (id) => request('DELETE', `/api/photos/${id}`),

  addFriend:    (b)   => request('POST', '/api/friends', b),
  acceptFriend: (rid) => request('PUT',  `/api/friends/${rid}/accept`, {}),
  getFriends:   ()    => request('GET',  '/api/friends'),
  getRecommendedFriends: () => request('GET', '/api/friends/recommended'),

  sendMessage:     (b)   => request('POST', '/api/messages', b),
  getConversation: (fid) => request('GET',  `/api/messages/${fid}`),

  listMealPlans:    ()     => request('GET',    '/api/meals'),
  logMeal:          (b)    => request('POST',   '/api/meal-logs', b),
  updateLoggedMeal: (id,b) => request('PUT',    `/api/meal-logs/${id}`, b),
  recognizeFood:    (fd)   => uploadFile('/api/meal-logs/recognize', fd),
  recognizeLabel:   (fd)   => uploadFile('/api/meal-logs/recognize-label', fd),
  parseMealVoice:   (b)    => request('POST', '/api/meal-logs/parse-voice', b),
  getMealsForDate:  (date) => request('GET',    `/api/meal-logs?date=${date}`),
  getMealLogHistory: ()    => request('GET',    '/api/meal-logs/history'),
  deleteLoggedMeal: (id)   => request('DELETE', `/api/meal-logs/${id}`),
  getMealPlan:      (id)   => request('GET',    `/api/meals/${id}`),
  renameMealPlan:   (id,b) => request('PUT',    `/api/meals/${id}/name`, b),
  toggleFavorite:   (id)   => request('PUT',    `/api/meals/${id}/favorite`, {}),
  deleteMealPlan:   (id)   => request('DELETE', `/api/meals/${id}`),
  generateMealPlan: (b)    => request('POST',   '/api/meals/generate', b),
  generateSingleMeal: (b)  => request('POST',   '/api/meals/generate-single', b),
  generateDayPlan: (b)     => request('POST',   '/api/meals/generate-day', b),
  swapMeal:         (b)    => request('POST',   '/api/meals/swap', b),

  getAchievements: () => request('GET', '/api/achievements'),

  getMealTemplates:  ()      => request('GET',  '/api/meals/templates'),
  useMealTemplate:   (id, b) => request('POST', `/api/meals/templates/${id}`, b),
  getMealRecipe:     (b)     => request('POST', '/api/meals/recipe', b),
  shareMealPlan:     (id,b)  => request('POST', `/api/meals/${id}/share`, b),
  regenerateMealPlan: (id,b) => request('POST', `/api/meals/${id}/regenerate`, b),
  createCustomMealPlan: (b)  => request('POST', '/api/meals/custom', b),

  getVapidPublicKey: ()    => request('GET',  '/api/push/vapid-public-key'),
  subscribePush:     (sub) => request('POST', '/api/push/subscribe', { subscription: sub }),
  unsubscribePush:   (b)   => request('POST', '/api/push/unsubscribe', b),

  getFeed:    ()        => request('GET',    '/api/feed'),
  react:      (id, r)   => request('POST',   `/api/feed/${id}/react`, { reaction: r }),
  unreact:    (id)      => request('DELETE', `/api/feed/${id}/react`),

  buzzFriend:     (friendId) => request('POST', `/api/social/buzz/${friendId}`, {}),
  getLeaderboard: (metric='workouts', period='week') => request('GET', `/api/social/leaderboard?metric=${metric}&period=${period}`),
  getStreak:      ()         => request('GET',  '/api/social/streak'),
  getVolume:      ()         => request('GET',  '/api/social/volume'),

  createCrew:   (b)      => request('POST', '/api/crews', b),
  getCrews:     ()       => request('GET',  '/api/crews'),
  getCrew:      (id)     => request('GET',  `/api/crews/${id}`),
  addCrewMember:(id, b)  => request('POST', `/api/crews/${id}/members`, b),
  getCrewInvites: ()     => request('GET',  '/api/crews/invites'),
  acceptCrewInvite: (id) => request('PUT',  `/api/crews/invites/${id}/accept`, {}),
  declineCrewInvite: (id)=> request('PUT',  `/api/crews/invites/${id}/decline`, {}),
  getCrewMessages: (id)  => request('GET',  `/api/crews/${id}/messages`),
  sendCrewMessage: (id,b)=> request('POST', `/api/crews/${id}/messages`, b),

  createChallenge: (b)   => request('POST', '/api/challenges', b),
  getChallenges:   ()    => request('GET',  '/api/challenges'),
  joinChallenge:   (id)  => request('POST', `/api/challenges/${id}/join`, {}),
  getChallengeProgress: (id) => request('GET', `/api/challenges/${id}/progress`),

  sendInvite:   (b)   => request('POST', '/api/invites', b),
  getInvites:   ()    => request('GET',  '/api/invites'),
  acceptInvite: (id)  => request('PUT',  `/api/invites/${id}/accept`, {}),
  declineInvite:(id)  => request('PUT',  `/api/invites/${id}/decline`, {}),

  getProfile:  ()    => request('GET', '/api/profile'),
  saveProfile: (p)   => request('PUT', '/api/profile', p),

  getWorkoutPlanTemplates: ()      => request('GET',  '/api/workout-plans/templates'),
  useWorkoutPlanTemplate:  (id,b)  => request('POST', `/api/workout-plans/templates/${id}`, b),
  getWorkoutPlans:  ()             => request('GET',  '/api/workout-plans'),
  getWorkoutPlan:   (id)           => request('GET',  `/api/workout-plans/${id}`),
  renameWorkoutPlan:(id,b)         => request('PUT',  `/api/workout-plans/${id}/name`, b),
  favoriteWorkoutPlan: (id)        => request('PUT',  `/api/workout-plans/${id}/favorite`, {}),
  deleteWorkoutPlan:(id)           => request('DELETE',`/api/workout-plans/${id}`),
  shareWorkoutPlan: (id,b)         => request('POST', `/api/workout-plans/${id}/share`, b),
  regenerateWorkoutPlan: (id,b)    => request('POST', `/api/workout-plans/${id}/regenerate`, b),
  generateWorkoutPlan: (b)         => request('POST', '/api/workout-plans/generate', b),
  createCustomWorkoutPlan: (b)     => request('POST', '/api/workout-plans/custom', b),
  swapPlanExercise: (b)            => request('POST', '/api/workout-plans/swap-exercise', b),
  editPlanExercise: (b)            => request('POST', '/api/workout-plans/edit-exercise', b),
  exerciseInfo:     (b)            => request('POST', '/api/workout-plans/exercise-info', b),

  fileUrl: (p) => {
    if (!p) return null;
    const filename = p.split('/').pop();
    const token = getToken();
    return `${BASE}/api/uploads/${encodeURIComponent(filename)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
};
