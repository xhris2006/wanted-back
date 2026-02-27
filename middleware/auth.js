const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Protéger les routes
exports.protect = catchAsync(async (req, res, next) => {
    let token;

    // Vérifier le token dans les headers ou les cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        return next(new AppError('Vous n\'êtes pas connecté. Veuillez vous connecter.', 401));
    }

    try {
        // Vérifier le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Vérifier si l'utilisateur existe toujours
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return next(new AppError('L\'utilisateur associé à ce token n\'existe plus.', 401));
        }

        // Vérifier si le compte est actif
        if (!user.isActive) {
            return next(new AppError('Ce compte a été désactivé.', 401));
        }

        // Vérifier si le mot de passe a été changé après la délivrance du token
        if (user.changedPasswordAfter(decoded.iat)) {
            return next(new AppError('Mot de passe récemment changé. Veuillez vous reconnecter.', 401));
        }

        // Ajouter l'utilisateur à la requête
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new AppError('Token invalide. Veuillez vous reconnecter.', 401));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new AppError('Token expiré. Veuillez vous reconnecter.', 401));
        }
        next(error);
    }
});

// Restreindre aux admins
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(new AppError('Vous n\'avez pas la permission d\'effectuer cette action.', 403));
        }
        next();
    };
};

// Vérifier la propriété
exports.checkOwnership = (Model, paramName = 'id') => {
    return catchAsync(async (req, res, next) => {
        const resource = await Model.findById(req.params[paramName]);
        
        if (!resource) {
            return next(new AppError('Ressource non trouvée', 404));
        }

        // Admin peut tout faire
        if (req.user.role === 'admin') {
            return next();
        }

        // Vérifier si l'utilisateur est le propriétaire
        const authorField = Model.modelName === 'User' ? '_id' : 'author';
        
        if (resource[authorField].toString() !== req.user.id) {
            return next(new AppError('Vous n\'êtes pas autorisé à modifier cette ressource', 403));
        }

        next();
    });
};