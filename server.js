const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json()); // Important pour lire les données envoyées par Edusign
app.set('view engine', 'ejs'); 

// ---------------------------------------------------------
// PORTE 1 : L'entrée pour Edusign (Block Builder)
// C'est cette URL que vous mettez dans "App Action" sur Edusign
// ---------------------------------------------------------
app.post('/edusign-action', (req, res) => {
    // Edusign envoie souvent les données (comme course_id) dans le body
    // Vérifiez si c'est req.body.courseId ou req.body.data.courseId selon leur doc
    const courseId = req.body.course_id || req.query.course_id; 
    
    // L'URL de votre propre serveur (à remplacer par votre vraie URL hébergée)
    const myHost = process.env.APP_URL || "https://thewheel.vercel.app"; 

    // On renvoie le JSON conforme à votre doc Block Builder
    const blocks = [
        {
            "block": "title",
            "text": "🎲 La Roue du Hasard"
        },
        {
            "block": "text",
            "text": "Lancez la roue pour désigner un étudiant aléatoirement !"
        },
        {
            // LE BLOC IFRAME QUI CONTIENT NOTRE ROUE
            "block": "iframe",
            "url": `${myHost}/wheel-view?course_id=${courseId}`,
            "height": "500px"
        }
    ];

    res.json(blocks);
});

// ---------------------------------------------------------
// PORTE 2 : La vue visuelle (HTML/Canvas)
// C'est la page qui sera chargée DANS l'iframe ci-dessus
// ---------------------------------------------------------
app.get('/wheel-view', async (req, res) => {
    const courseId = req.query.course_id;
    const API_KEY = process.env.EDUSIGN_API_KEY;

    if (!courseId) return res.send("Erreur : Pas d'ID de cours");

    try {
        // Récupération des étudiants via l'API Edusign
        const response = await axios.get(`https://api.edusign.fr/v1/course/${courseId}/students`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        
        const students = response.data.result || [];
        const studentNames = students.map(s => `${s.firstname} ${s.lastname}`);

        // On renvoie le fichier wheel.ejs (le code HTML de la roue)
        res.render('wheel', { students: JSON.stringify(studentNames) });

    } catch (error) {
        console.error('Erreur API Edusign:', error.message);
        res.send("Erreur API Edusign");
    }
});

// Route de test pour voir la roue avec des données mockées
app.get('/demo', (req, res) => {
    const demoStudents = ["Alice Martin", "Bob Dupont", "Charlie Durand", "Diana Lopez", "Emma Bernard", "Frank Petit"];
    res.render('wheel', { students: JSON.stringify(demoStudents) });
});

// Health check pour Vercel
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: '🎡 The Wheel is running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🎡 Serveur prêt sur le port ${PORT}`));
