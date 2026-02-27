require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const Comment = require('./models/Comment');
const connectDB = require('./config/database');

// Données de test
const users = [
    {
        name: 'Jean Dupont',
        email: 'jean@test.com',
        password: 'password123',
        bio: 'Passionné de photographie et de voyages ✈️',
        isOnline: true
    },
    {
        name: 'Marie Martin',
        email: 'marie@test.com',
        password: 'password123',
        bio: 'Amoureuse de la nature 🌿',
        isOnline: false
    },
    {
        name: 'Pierre Durand',
        email: 'pierre@test.com',
        password: 'password123',
        bio: 'Développeur web et entrepreneur 💻',
        isOnline: true
    }
];

const posts = [
    {
        content: 'Superbe journée ensoleillée ! ☀️',
        visibility: 'public'
    },
    {
        content: 'Nouveau projet passionnant en cours...',
        visibility: 'public'
    }
];

const comments = [
    {
        content: 'Magnifique photo !'
    },
    {
        content: 'Hâte de voir le résultat !'
    }
];

// Fonction pour seed la base
const seedDatabase = async () => {
    try {
        // Connexion à MongoDB
        await connectDB();
        
        console.log('🗑️  Suppression des données existantes...');
        await User.deleteMany({});
        await Post.deleteMany({});
        await Comment.deleteMany({});
        
        console.log('👥 Création des utilisateurs...');
        const createdUsers = await User.create(users);
        
        console.log('📝 Création des posts...');
        const postsWithAuthors = posts.map((post, index) => ({
            ...post,
            author: createdUsers[index % createdUsers.length]._id
        }));
        const createdPosts = await Post.create(postsWithAuthors);
        
        console.log('💬 Création des commentaires...');
        const commentsWithData = comments.map((comment, index) => ({
            ...comment,
            author: createdUsers[(index + 1) % createdUsers.length]._id,
            post: createdPosts[index % createdPosts.length]._id
        }));
        const createdComments = await Comment.create(commentsWithData);
        
        // Ajouter les commentaires aux posts
        for (let i = 0; i < createdComments.length; i++) {
            const comment = createdComments[i];
            await Post.findByIdAndUpdate(comment.post, {
                $push: { comments: comment._id }
            });
        }
        
        // Ajouter des followers
        await User.findByIdAndUpdate(createdUsers[0]._id, {
            $push: { 
                following: createdUsers[1]._id,
                followers: createdUsers[2]._id
            }
        });
        
        await User.findByIdAndUpdate(createdUsers[1]._id, {
            $push: { following: createdUsers[0]._id }
        });
        
        await User.findByIdAndUpdate(createdUsers[2]._id, {
            $push: { followers: createdUsers[0]._id }
        });
        
        console.log('✅ Base de données initialisée avec succès !');
        console.log('📊 Statistiques :');
        console.log(`   - ${createdUsers.length} utilisateurs`);
        console.log(`   - ${createdPosts.length} posts`);
        console.log(`   - ${createdComments.length} commentaires`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors du seed :', error);
        process.exit(1);
    }
};

seedDatabase();
