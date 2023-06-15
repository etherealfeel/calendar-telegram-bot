const Router = require('express')
const router = new Router()
const timerController = require('../controllers/timer.controller')

router.post('/timer', timerController.createTimer);
router.put('/timer', timerController.updateTimer);
router.get('/timer', timerController.getTimer);

module.exports = router