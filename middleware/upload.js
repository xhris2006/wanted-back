const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const AppError = require('../utils/AppError');

// Configuration du stockage
const storage = multer.memoryStorage();

// Filtre pour les fichiers images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new AppError('Veuillez uploader uniquement des images', 400), false);
    }
};

// Configuration de multer
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: process.env.MAX_FILE_SIZE * 1024 * 1024 || 5 * 1024 * 1024 // 5MB par défaut
    }
});

// Middleware pour optimiser les images
const optimizeImage = async (req, res, next) => {
    if (!req.file) return next();

    try {
        const filename = `user-${req.user.id}-${Date.now()}.jpeg`;
        const uploadPath = path.join(__dirname, '../uploads', req.fileType || 'others');
        
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        // Optimiser l'image avec Sharp
        await sharp(req.file.buffer)
            .resize(req.resizeOptions?.width || 800, req.resizeOptions?.height || 800, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 90 })
            .toFile(path.join(uploadPath, filename));

        // Ajouter l'URL de l'image à la requête
        req.imageUrl = `/uploads/${req.fileType || 'others'}/${filename}`;
        
        next();
    } catch (error) {
        next(new AppError('Erreur lors du traitement de l\'image', 500));
    }
};

// Middleware pour upload de photo de profil
const uploadAvatar = [
    upload.single('avatar'),
    (req, res, next) => {
        req.fileType = 'avatars';
        req.resizeOptions = { width: 400, height: 400 };
        next();
    },
    optimizeImage
];

// Middleware pour upload de photo de couverture
const uploadCover = [
    upload.single('cover'),
    (req, res, next) => {
        req.fileType = 'covers';
        req.resizeOptions = { width: 1200, height: 400 };
        next();
    },
    optimizeImage
];

// Middleware pour upload de photo de post
const uploadPostImage = [
    upload.single('image'),
    (req, res, next) => {
        req.fileType = 'posts';
        req.resizeOptions = { width: 1200, height: 1200 };
        next();
    },
    optimizeImage
];

// Middleware pour upload multiple
const uploadMultiple = upload.array('images', process.env.MAX_FILES || 10);

module.exports = {
    upload,
    uploadAvatar,
    uploadCover,
    uploadPostImage,
    uploadMultiple
};