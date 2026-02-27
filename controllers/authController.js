const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');


const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};


const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);
    
    
    user.password = undefined;

    
    const cookieOptions = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    };

    res.cookie('jwt', token, cookieOptions);

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user
        }
    });
};

// Inscription
exports.register = catchAsync(async (req, res, next) => {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new AppError(errors.array()[0].msg, 400));
    }

    const { name, email, password } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return next(new AppError('Cet email est déjà utilisé', 400));
    }

    // Créer l'utilisateur
    const user = await User.create({
        name,
        email,
        password
    });

    createSendToken(user, 201, res);
});

// Connexion
exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    // Vérifier si email et password existent
    if (!email || !password) {
        return next(new AppError('Veuillez fournir un email et un mot de passe', 400));
    }

    // Chercher l'utilisateur avec le password
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
        return next(new AppError('Email ou mot de passe incorrect', 401));
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
        return next(new AppError('Ce compte a été désactivé', 401));
    }

    // Mettre à jour le statut en ligne
    user.isOnline = true;
    await user.save({ validateBeforeSave: false });

    createSendToken(user, 200, res);
});

// Déconnexion
exports.logout = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.user.id);
    
    if (user) {
        user.isOnline = false;
        user.lastSeen = new Date();
        await user.save({ validateBeforeSave: false });
    }

    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });

    res.status(200).json({ 
        status: 'success',
        message: 'Déconnexion réussie' 
    });
});

// Mot de passe oublié
exports.forgotPassword = catchAsync(async (req, res, next) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return next(new AppError('Aucun utilisateur avec cet email', 404));
    }

    // Générer un token de réinitialisation
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    user.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save({ validateBeforeSave: false });

    // Envoyer l'email (à implémenter)
    // await sendEmail(...);

    res.status(200).json({
        status: 'success',
        message: 'Token envoyé par email'
    });
});

// Réinitialiser le mot de passe
exports.resetPassword = catchAsync(async (req, res, next) => {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
        return next(new AppError('Token invalide ou expiré', 400));
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    createSendToken(user, 200, res);
});

// Changer le mot de passe (connecté)
exports.updatePassword = catchAsync(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
        return next(new AppError('Mot de passe actuel incorrect', 401));
    }

    user.password = newPassword;
    await user.save();

    createSendToken(user, 200, res);
});

// Rafraîchir le token
exports.refreshToken = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.user.id);
    createSendToken(user, 200, res);
});