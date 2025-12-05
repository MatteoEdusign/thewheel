const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

// Middleware pour parser le JSON et les données URL-encoded (form-data)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------
// PORTE 1 : L'entrée pour Edusign (Block Builder)
// ---------------------------------------------------------
app.post('/edusign-action', (req, res) => {
    console.log('🔔 [Edusign Action] Hit ! Body:', req.body);

    // Récupération de l'ID, compatible POST body, GET query, ou context Edusign
    const courseId = req.body.course_id || req.query.course_id || req.body.data?.course_id || req.body.context?.courseId;

    // Gestion propre de l'URL
    let myHost = process.env.APP_URL || "https://thewheel-henna.vercel.app";
    if (myHost.endsWith('/')) myHost = myHost.slice(0, -1);

    // Réponse conforme à la doc Block Builder avec des IDs uniques
    const blocks = [
        {
            "id": "title_blk",
            "block": "title",
            "text": "🎲 La Roue du Hasard"
        },
        {
            "id": "text_blk",
            "block": "text",
            "text": "C'est l'heure d'interroger quelqu'un au hasard..."
        },
        {
            "id": "iframe_blk",
            "block": "iframe",
            "url": `${myHost}/wheel-view?course_id=${courseId}`,
            "height": "520px"
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

    console.log(`👀 [Wheel View] Loading for course: ${courseId}`);

    // Mode démo
    if (!courseId || courseId === 'TEST') {
        const demoStudents = ["Alice", "Bob", "Charlie", "David", "Emma", "Farah", "Gabriel", "Hugo"];
        return res.render('wheel', { students: JSON.stringify(demoStudents) });
    }

    try {
        // RETOUR À L'ANCIEN ENDPOINT
        // Maintenant qu'on a le bon courseId, on peut utiliser l'endpoint qui renvoie les NOMS.
        const response = await axios.get(`https://api.edusign.fr/v1/course/${courseId}/students`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        console.log('✅ [API Edusign] Response received from /students');

        const result = response.data.result || [];

        // DEBUG LOGGING
        console.log(`🔍 [DEBUG] Found ${result.length} students via /students endpoint.`);
        if (result.length > 0) {
            console.log('🔍 [DEBUG] First student sample:', JSON.stringify(result[0], null, 2));
        }

        let studentNames = [];

        if (result.length > 0) {
            // On espère avoir firstname et lastname ici
            studentNames = result.map(s => {
                if (s.firstname && s.lastname) {
                    return `${s.firstname} ${s.lastname.charAt(0)}.`;
                } else if (s.name) {
                    return s.name;
                } else {
                    return "Étudiant (Sans nom)";
                }
            });
        }

        if (studentNames.length === 0) {
            return res.render('wheel', { students: JSON.stringify(["Aucun élève"]) });
        }

        res.render('wheel', { students: JSON.stringify(studentNames) });

    } catch (error) {
        console.error('❌ [API Error]', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
            console.error('Status:', error.response.status);
        }

        // Fallback gracieux pour ne pas montrer une page d'erreur moche
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