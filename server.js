const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Chemin absolu pour Vercel
app.use(express.static(path.join(__dirname, 'public'))); // Fichiers statiques

// ---------------------------------------------------------
// PORTE 1 : L'entrée pour Edusign (Block Builder)
// ---------------------------------------------------------
app.post('/edusign-action', (req, res) => {
    // Récupération de l'ID, compatible POST body ou GET query
    const courseId = req.body.course_id || req.query.course_id || req.body.data?.course_id;

    // Gestion propre de l'URL (enlève le slash final s'il existe)
    let myHost = process.env.APP_URL || "https://thewheel-henna.vercel.app";
    if (myHost.endsWith('/')) myHost = myHost.slice(0, -1);

    const blocks = [
        {
            "block": "title",
            "text": "🎲 La Roue du Hasard"
        },
        {
            "block": "text",
            "text": "C'est l'heure d'interroger quelqu'un au hasard..."
        },
        {
            "block": "iframe",
            "url": `${myHost}/wheel-view?course_id=${courseId}`,
            "height": "520px" // Hauteur ajustée pour la roue
        }
    ];

    res.json(blocks);
});

// ---------------------------------------------------------
// PORTE 2 : La vue visuelle (La Roue Stylée)
// ---------------------------------------------------------
app.get('/wheel-view', async (req, res) => {
    const courseId = req.query.course_id;
    const API_KEY = process.env.EDUSIGN_API_KEY;

    // Mode démo si on tape "TEST" ou s'il n'y a pas d'ID
    if (!courseId || courseId === 'TEST') {
        const demoStudents = ["Alice", "Bob", "Charlie", "David", "Emma", "Farah", "Gabriel", "Hugo"];
        return res.render('wheel', { students: JSON.stringify(demoStudents) });
    }

    try {
        const response = await axios.get(`https://api.edusign.fr/v1/course/${courseId}/students`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        const students = response.data.result || [];
        // On prend prénom + initiale du nom pour que ça rentre bien dans la roue
        const studentNames = students.map(s => `${s.firstname} ${s.lastname.charAt(0)}.`);

        if (studentNames.length === 0) {
            return res.render('wheel', { students: JSON.stringify(["Aucun élève"]) });
        }

        res.render('wheel', { students: JSON.stringify(studentNames) });

    } catch (error) {
        console.error('Erreur API Edusign:', error.message);
        // En cas d'erreur, on affiche quand même la page mais avec un message
        res.render('wheel', { students: JSON.stringify(["Erreur API"]) });
    }
});

// Route de démo directe
app.get('/demo', (req, res) => {
    const demoStudents = ["Thomas", "Manon", "Alexandre", "Sophie", "Nicolas", "Julie"];
    res.render('wheel', { students: JSON.stringify(demoStudents) });
});

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: '🎡 The Wheel is running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🎡 Serveur prêt sur le port ${PORT}`));