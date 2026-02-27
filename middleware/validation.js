const { body, param, query, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

// Middleware de validation
const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        const messages = errors.array().map(error => error.msg);
        next(new AppError(messages.join(', '), 400));
    };
};

// Validations pour les utilisateurs
const userValidations = {
    register: [
        body('name')
            .trim()
            .notEmpty().withMessage('Le nom est requis')
            .isLength({ min: 2, max: 50 }).withMessage('Le nom doit contenir entre 2 et 50 caractères')
            .matches(/^[a-zA-Z0-9\s\-']+$/).withMessage('Le nom contient des caractères invalides'),
        
        body('email')
            .trim()
            .notEmpty().withMessage('L\'email est requis')
            .isEmail().withMessage('Email invalide')
            .normalizeEmail(),
        
        body('password')
            .notEmpty().withMessage('Le mot de passe est requis')
            .isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères')
            .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('Le mot de passe doit contenir au moins une lettre et un chiffre')
    ],

    login: [
        body('email')
            .trim()
            .notEmpty().withMessage('L\'email est requis')
            .isEmail().withMessage('Email invalide'),
        
        body('password')
            .notEmpty().withMessage('Le mot de passe est requis')
    ],

    updateProfile: [
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 }).withMessage('Le nom doit contenir entre 2 et 50 caractères')
            .matches(/^[a-zA-Z0-9\s\-']+$/).withMessage('Le nom contient des caractères invalides'),
        
        body('bio')
            .optional()
            .trim()
            .isLength({ max: 200 }).withMessage('La bio ne peut pas dépasser 200 caractères')
    ]
};

// Validations pour les posts
const postValidations = {
    create: [
        body('content')
            .trim()
            .notEmpty().withMessage('Le contenu est requis')
            .isLength({ max: 500 }).withMessage('Le contenu ne peut pas dépasser 500 caractères'),
        
        body('visibility')
            .optional()
            .isIn(['public', 'friends', 'private']).withMessage('Visibilité invalide'),
        
        body('location')
            .optional()
            .trim()
            .isLength({ max: 100 }).withMessage('La localisation est trop longue')
    ],

    update: [
        body('content')
            .optional()
            .trim()
            .isLength({ max: 500 }).withMessage('Le contenu ne peut pas dépasser 500 caractères')
    ]
};

// Validations pour les commentaires
const commentValidations = {
    create: [
        body('content')
            .trim()
            .notEmpty().withMessage('Le commentaire est requis')
            .isLength({ max: 200 }).withMessage('Le commentaire ne peut pas dépasser 200 caractères')
    ],

    update: [
        body('content')
            .trim()
            .notEmpty().withMessage('Le commentaire est requis')
            .isLength({ max: 200 }).withMessage('Le commentaire ne peut pas dépasser 200 caractères')
    ]
};

// Validations pour les messages
const messageValidations = {
    send: [
        body('content')
            .trim()
            .notEmpty().withMessage('Le message est requis')
            .isLength({ max: 1000 }).withMessage('Le message ne peut pas dépasser 1000 caractères'),
        
        body('conversationId')
            .optional()
            .isMongoId().withMessage('ID de conversation invalide'),
        
        body('recipientId')
            .optional()
            .isMongoId().withMessage('ID de destinataire invalide')
    ]
};

// Validations pour les paramètres
const paramValidations = {
    userId: [
        param('userId')
            .isMongoId().withMessage('ID utilisateur invalide')
    ],
    
    postId: [
        param('postId')
            .isMongoId().withMessage('ID de post invalide')
    ],
    
    commentId: [
        param('commentId')
            .isMongoId().withMessage('ID de commentaire invalide')
    ],
    
    conversationId: [
        param('conversationId')
            .isMongoId().withMessage('ID de conversation invalide')
    ]
};

// Validations pour la pagination
const paginationValidations = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('La page doit être un nombre positif'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100'),
    
    query('sort')
        .optional()
        .isIn(['asc', 'desc']).withMessage('Le tri doit être asc ou desc')
];

module.exports = {
    validate,
    userValidations,
    postValidations,
    commentValidations,
    messageValidations,
    paramValidations,
    paginationValidations
};