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
            "height": "650px"
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
        // ÉTAPE 1 : Récupérer la liste des IDs via le cours
        console.log(`⏳ [Step 1] Fetching course details for ID: ${courseId}`);
        const courseResponse = await axios.get(`https://ext.edusign.fr/v1/course/${courseId}`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        const courseData = courseResponse.data.result || courseResponse.data;
        const studentsList = courseData.STUDENTS || [];

        console.log(`✅ [Step 1] Found ${studentsList.length} student IDs.`);

        if (studentsList.length === 0) {
            return res.render('wheel', { students: JSON.stringify(["Aucun élève"]) });
        }

        // ÉTAPE 2 : Récupérer les détails de chaque étudiant (Nom/Prénom)
        // On limite à 50 pour éviter de spammer l'API si le cours est énorme
        const studentsToFetch = studentsList.slice(0, 50);
        console.log(`⏳ [Step 2] Fetching details for ${studentsToFetch.length} students...`);

        const studentPromises = studentsToFetch.map(async (s) => {
            try {
                // L'ID est dans s.studentId d'après les logs
                const sId = s.studentId || s.id;
                if (!sId) return "ID Inconnu";

                const studentResponse = await axios.get(`https://ext.edusign.fr/v1/student/${sId}`, {
                    headers: { 'Authorization': `Bearer ${API_KEY}` }
                });

                const sData = studentResponse.data.result;
                if (sData && sData.FIRSTNAME) {
                    return `${sData.FIRSTNAME} ${sData.LASTNAME ? sData.LASTNAME.charAt(0) + '.' : ''}`;
                }
                return "Étudiant (Sans nom)";
            } catch (err) {
                console.warn(`⚠️ [API Warning] Failed to fetch student ${s.studentId}:`, err.message);
                return "Étudiant Inconnu";
            }
        });

        // Attendre que toutes les requêtes soient finies
        let studentNames = await Promise.all(studentPromises);

        // Filtrer les éventuels échecs complets si nécessaire, ou garder les placeholders
        console.log('✅ [Step 2] All student details fetched.');
        console.log('🔍 [DEBUG] Final Student Names List:', JSON.stringify(studentNames, null, 2));

        if (studentNames.length === 0) {
            studentNames = ["Aucun élève trouvé"];
        }

        res.render('wheel', { students: JSON.stringify(studentNames) });

    } catch (error) {
        console.error('❌ [API Error]', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
        }
        res.render('wheel', { students: JSON.stringify(["Erreur API"]) });
    }
});

// Route de démo directe
app.get('/demo', (req, res) => {
    const demoStudents = ["Thomas", "Manon", "Alexandre", "Sophie", "Nicolas", "Julie"];
    res.render('wheel', { students: JSON.stringify(demoStudents) });
});

// ---------------------------------------------------------
// PORTE 3 : Webhooks Marketplace (Installation/Désinstallation)
// ---------------------------------------------------------
app.post('/install', (req, res) => {
    console.log('📥 [Webhook Install] Received:', req.body);
    // TODO: Dans une vraie app multi-clients, sauvegarder req.body.token associé à req.body.schoolId dans une base de données.
    // Pour l'instant, on log juste et on valide.
    res.status(200).send("App successfully installed");
});

app.post('/uninstall', (req, res) => {
    console.log('🗑️ [Webhook Uninstall] Received:', req.body);
    // TODO: Supprimer les données de l'école dans la base de données.
    res.status(200).send("App successfully uninstalled");
});

// ---------------------------------------------------------
// PORTE 4 : Pages Légales & Support (Redirections Edusign)
// ---------------------------------------------------------
app.get('/privacy', (req, res) => {
    res.redirect('https://www.edusign.fr/politique-de-confidentialite/');
});

app.get('/terms', (req, res) => {
    res.redirect('https://www.edusign.fr/cgu/');
});

app.get('/support', (req, res) => {
    res.redirect('https://www.edusign.fr/contact/');
});

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: '🎡 The Wheel is running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🎡 Serveur prêt sur le port ${PORT}`));