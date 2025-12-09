const express = require('express');
const axios = require('axios');
const path = require('path');
const { Pool } = require('pg');
const app = express();

// Connexion PostgreSQL (Replit fournit DATABASE_URL automatiquement)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Middleware pour parser le JSON et les données URL-encoded (form-data)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------
// Helper : Récupérer le token API pour une école donnée
// ---------------------------------------------------------
async function getApiKeyForSchool(schoolId) {
    if (!schoolId) return process.env.EDUSIGN_API_KEY; // Fallback pour démo/test
    try {
        const result = await pool.query(
            'SELECT token FROM school_tokens WHERE school_id = $1',
            [schoolId]
        );
        if (result.rows.length > 0) {
            return result.rows[0].token;
        }
        return process.env.EDUSIGN_API_KEY; // Fallback si pas trouvé
    } catch (error) {
        console.error('❌ [DB Error] Failed to get token:', error.message);
        return process.env.EDUSIGN_API_KEY; // Fallback en cas d'erreur
    }
}

// ---------------------------------------------------------
// PORTE 1 : L'entrée pour Edusign (Block Builder)
// ---------------------------------------------------------
app.post('/edusign-action', (req, res) => {
    console.log('🔔 [Edusign Action] Hit ! Body:', req.body);

    // Récupération des IDs depuis le contexte Edusign
    const courseId = req.body.course_id || req.query.course_id || req.body.data?.course_id || req.body.context?.courseId;
    const schoolId = req.body.school_id || req.body.schoolId || req.body.context?.schoolId;

    console.log(`📍 [Edusign Action] courseId: ${courseId}, schoolId: ${schoolId}`);

    // Gestion propre de l'URL
    let myHost = process.env.APP_URL || "https://thewheel-edusign.replit.app";
    if (myHost.endsWith('/')) myHost = myHost.slice(0, -1);

    // On passe le schoolId dans l'URL pour pouvoir récupérer le bon token
    const blocks = [
        {
            "id": "iframe_blk",
            "block": "iframe",
            "url": `${myHost}/wheel-view?course_id=${courseId}&school_id=${schoolId}`,
            "height": "550px"
        }
    ];

    res.json(blocks);
});

// ---------------------------------------------------------
// PORTE 2 : La vue visuelle (La Roue Stylée)
// ---------------------------------------------------------
app.get('/wheel-view', async (req, res) => {
    const courseId = req.query.course_id;
    const schoolId = req.query.school_id;

    console.log(`👀 [Wheel View] Loading for course: ${courseId}, school: ${schoolId}`);

    // Mode démo
    if (!courseId || courseId === 'TEST' || courseId === 'undefined') {
        const demoStudents = ["Alice", "Bob", "Charlie", "David", "Emma", "Farah", "Gabriel", "Hugo"];
        return res.render('wheel', { students: JSON.stringify(demoStudents) });
    }

    // Récupérer le token API pour cette école
    const API_KEY = await getApiKeyForSchool(schoolId);

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
        const studentsToFetch = studentsList.slice(0, 50);
        console.log(`⏳ [Step 2] Fetching details for ${studentsToFetch.length} students...`);

        const studentPromises = studentsToFetch.map(async (s) => {
            try {
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

        let studentNames = await Promise.all(studentPromises);

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
app.post('/install', async (req, res) => {
    console.log('📥 [Webhook Install] Received:', req.body);

    try {
        const { schoolId, token } = req.body;

        if (schoolId && token) {
            // Stocker le token pour cette école (INSERT ou UPDATE si existe déjà)
            await pool.query(
                `INSERT INTO school_tokens (school_id, token) 
                 VALUES ($1, $2) 
                 ON CONFLICT (school_id) 
                 DO UPDATE SET token = $2, created_at = CURRENT_TIMESTAMP`,
                [schoolId, token]
            );
            console.log(`✅ [Install] Token saved for school: ${schoolId}`);
        }

        res.status(200).send("App successfully installed");
    } catch (error) {
        console.error('❌ [Install Error]', error.message);
        res.status(500).send("Error installing app");
    }
});

app.post('/uninstall', async (req, res) => {
    console.log('🗑️ [Webhook Uninstall] Received:', req.body);

    try {
        const { schoolId } = req.body;

        if (schoolId) {
            // Supprimer le token pour cette école
            await pool.query(
                'DELETE FROM school_tokens WHERE school_id = $1',
                [schoolId]
            );
            console.log(`✅ [Uninstall] Token deleted for school: ${schoolId}`);
        }

        res.status(200).send("App successfully uninstalled");
    } catch (error) {
        console.error('❌ [Uninstall Error]', error.message);
        res.status(500).send("Error uninstalling app");
    }
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

// ---------------------------------------------------------
// TEST : Vérifier que la base de données fonctionne
// ---------------------------------------------------------
app.get('/test-db', async (req, res) => {
    try {
        const testSchoolId = 'test-school-' + Date.now();
        const testToken = 'test-token-abc';

        // 1. Écrire
        await pool.query(
            'INSERT INTO school_tokens (school_id, token) VALUES ($1, $2)',
            [testSchoolId, testToken]
        );
        console.log('✅ [Test DB] Write successful');

        // 2. Lire
        const result = await pool.query(
            'SELECT token FROM school_tokens WHERE school_id = $1',
            [testSchoolId]
        );
        const readToken = result.rows[0]?.token;
        console.log('✅ [Test DB] Read successful:', readToken);

        // 3. Supprimer (nettoyage)
        await pool.query(
            'DELETE FROM school_tokens WHERE school_id = $1',
            [testSchoolId]
        );
        console.log('✅ [Test DB] Delete successful');

        // 4. Vérifier
        if (readToken === testToken) {
            res.json({
                success: true,
                message: '🎉 PostgreSQL fonctionne parfaitement !',
                details: {
                    written: testToken,
                    read: readToken,
                    match: true
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: '❌ Les valeurs ne correspondent pas',
                details: { written: testToken, read: readToken }
            });
        }
    } catch (error) {
        console.error('❌ [Test DB] Error:', error);
        res.status(500).json({
            success: false,
            message: '❌ Erreur de connexion à PostgreSQL',
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🎡 Serveur prêt sur le port ${PORT}`));