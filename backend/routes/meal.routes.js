const router = require('express').Router();
const auth   = require('../middleware/auth');
const aiQuota = require('../middleware/aiQuota');
const {
  listPlans, getPlan, renamePlan, toggleFavorite, deletePlan,
  generate, regenerate, swap, getRecipe, getTemplates, getTemplateById, useTemplate, sharePlan, createCustom,
  generateSingleMeal, generateDayPlan,
} = require('../controllers/meal.controller');

router.use(auth);
router.get('/templates',         getTemplates);
router.get('/templates/:id',     getTemplateById);
router.post('/templates/:id',    useTemplate);
router.get('/',                  listPlans);
router.get('/:id',               getPlan);
router.put('/:id/name',          renamePlan);
router.put('/:id/favorite',      toggleFavorite);
router.delete('/:id',            deletePlan);
router.post('/:id/share',        sharePlan);
router.post('/:id/regenerate',   aiQuota('meal_plan'), regenerate);
router.post('/custom',           createCustom);
router.post('/generate',         aiQuota('meal_plan'), generate);
router.post('/generate-single',  aiQuota('meal_plan'), generateSingleMeal);
router.post('/generate-day',     aiQuota('meal_plan'), generateDayPlan);
router.post('/swap',             swap);
router.post('/recipe',           getRecipe);
module.exports = router;
