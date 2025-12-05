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

    // Récupération de l'ID, compatible POST body ou GET query
    const courseId = req.body.course_id || req.query.course_id || req.body.data?.course_id;

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
        // NOUVEL ENDPOINT : ext.edusign.fr
        // Attention : cet endpoint renvoie les détails du cours.
        // On espère y trouver la liste des étudiants avec leurs noms.
        const response = await axios.get(`https://ext.edusign.fr/v1/course/${courseId}`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        console.log('✅ [API Edusign] Response received');

        // Structure attendue selon la doc fournie : result.STUDENTS (array)
        const courseData = response.data.result;
        const studentsList = courseData.STUDENTS || [];

        // Problème potentiel : la doc dit que STUDENTS contient { studentId: "..." }
        // Si on n'a pas les noms, on va devoir improviser ou faire un fallback.
        // Pour l'instant, on essaie de mapper ce qu'on trouve.

        let studentNames = [];

        if (studentsList.length > 0) {
            // Cas 1 : L'objet contient firstname/lastname (le meilleur cas)
            if (studentsList[0].firstname) {
                studentNames = studentsList.map(s => `${s.firstname} ${s.lastname ? s.lastname.charAt(0) + '.' : ''}`);
            }
            // Cas 2 : On a que des IDs... C'est embêtant.
            else {
                console.warn('⚠️ [API Warning] Pas de noms trouvés, seulement des IDs ?', studentsList[0]);
                // Fallback : on affiche "Étudiant 1", "Étudiant 2" ou on tente l'ancien endpoint
                // Pour ce fix, on va tenter de voir si on peut récupérer les infos autrement
                // Mais pour éviter le crash, on met des placeholders si nécessaire
                studentNames = studentsList.map((s, i) => `Étudiant ${i + 1}`);
            }
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