const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  getTemplates, useTemplate,
  listPlans, getPlan, renamePlan, toggleFavorite, deletePlan, sharePlan,
  generate, regenerate, reorderPlan, swapExercise, editExercise, exerciseInfo, createCustom,
} = require('../controllers/workoutplan.controller');

router.use(auth);
router.get('/templates',       getTemplates);
router.post('/templates/:id',  useTemplate);
router.get('/',                listPlans);
router.post('/custom',         createCustom);
router.get('/:id',             getPlan);
router.put('/:id/name',        renamePlan);
router.put('/:id/favorite',    toggleFavorite);
router.delete('/:id',          deletePlan);
router.post('/:id/share',      sharePlan);
router.post('/:id/regenerate', regenerate);
router.post('/:id/reorder',    reorderPlan);
router.post('/generate',       generate);
router.post('/swap-exercise',  swapExercise);
router.post('/edit-exercise',  editExercise);
router.post('/exercise-info',  exerciseInfo);

module.exports = router;
