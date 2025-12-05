# 🎲 The Wheel - Edusign Integration

Une application de roue de la fortune pour désigner aléatoirement un étudiant dans Edusign.

## 🚀 Fonctionnalités

- **Intégration Block Builder** : S'intègre directement dans l'interface Edusign via un iframe
- **Design moderne** : Interface élégante avec animations et confettis
- **Responsive** : Fonctionne sur tous les appareils
- **API Edusign** : Récupère automatiquement la liste des étudiants du cours

## 📋 Installation

```bash
npm install
npm start
```

## 🔧 Configuration

Définissez les variables d'environnement suivantes :

- `EDUSIGN_API_KEY` : Votre clé API Edusign
- `APP_URL` : L'URL de votre application déployée (ex: https://thewheel.vercel.app)

## 🎯 Endpoints

| Route | Méthode | Description |
|-------|---------|-------------|
| `/` | GET | Health check |
| `/edusign-action` | POST | Point d'entrée Block Builder |
| `/wheel-view` | GET | Vue de la roue (chargée dans l'iframe) |
| `/demo` | GET | Démonstration avec données fictives |

## 🔌 Configuration Edusign

1. Dans Edusign, créez une nouvelle App Action
2. Configurez l'URL : `https://votre-app.vercel.app/edusign-action`
3. La roue apparaîtra dans un bloc iframe dans vos cours

## 📦 Déploiement sur Vercel

```bash
vercel --prod
```

N'oubliez pas de configurer les variables d'environnement dans le dashboard Vercel.

## 📝 License

ISC
