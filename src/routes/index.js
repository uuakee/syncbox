const express = require('express');
const router = express.Router();

const UserController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const SyncController = require('../controllers/syncController');


router.post('/register', UserController.register);
router.post('/login', UserController.login);

router.use(authMiddleware); // Adiciona o middleware a todas as rotas abaixo

router.post('/save-credentials', UserController.saveDatabaseCredentials);
router.get('/user-connections', UserController.getUserConnections);
router.get('/categories-movies', SyncController.getCategoriesMovies);

router.get('/bouquets', SyncController.getBouquets);
router.get('/categories-movies-m3u', SyncController.getCategoriesMoviesM3U);
router.get('/categories-series-m3u', SyncController.getCategoriesSeriesM3U);
router.get('/download-m3u', SyncController.getDownloadM3U);
router.get('/test-m3u-parser', SyncController.testM3UParser);
router.get('/download-and-parse-m3u', SyncController.downloadAndParseM3U);
router.post('/sync-m3u', SyncController.importM3UDataToXUI);
router.post('/sync-m3u-series', SyncController.importM3UDataToXUIForSeries);
router.get('/getPlan', UserController.getPlan);

module.exports = router;
