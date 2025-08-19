# BE FOR NOR KA - Gestionnaire d'Association de Volleyball

Application de gestion complète pour une association de volleyball affiliée FFVB.

## Fonctionnalités

- **Inscription des membres** avec gestion des catégories d'âge
- **Gestion des documents** (formulaires FFVB, certificats médicaux, etc.)
- **Calendrier des entraînements** avec confirmation de présence
- **Tableau de bord administrateur** pour la validation des dossiers
- **Gestion des présences** par les entraîneurs
- **Système d'invitations** par email

## Configuration de la base de données

Cette application utilise **Supabase** comme base de données. Voici comment la configurer :

### 1. Créer un compte Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte gratuit
3. Créez un nouveau projet

### 2. Configuration des variables d'environnement

1. Copiez le fichier `.env.example` vers `.env`
2. Dans votre tableau de bord Supabase, allez dans **Settings > API**
3. Copiez les valeurs suivantes :
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-anonyme
```

### 3. Exécuter les migrations

1. Dans votre tableau de bord Supabase, allez dans **SQL Editor**
2. Copiez et exécutez le contenu du fichier `supabase/migrations/001_initial_schema.sql`

### 4. Configuration de l'authentification (optionnel)

Si vous souhaitez activer l'authentification :
1. Allez dans **Authentication > Settings**
2. Configurez les providers souhaités
3. Désactivez la confirmation par email si nécessaire

## Installation et démarrage

```bash
# Installation des dépendances
npm install

# Démarrage en mode développement
npm run dev

# Build pour la production
npm run build
```

## Structure de la base de données

### Tables principales

- **members** : Informations des membres et statut des documents
- **training_sessions** : Séances d'entraînement programmées
- **attendance_records** : Présences et absences aux entraînements

### Sécurité

- Row Level Security (RLS) activé sur toutes les tables
- Politiques d'accès configurées pour les utilisateurs authentifiés
- Validation des données au niveau de la base

## Avantages de Supabase

✅ **Gratuit** jusqu'à 500MB de stockage et 2GB de bande passante  
✅ **PostgreSQL** complet avec toutes les fonctionnalités avancées  
✅ **API REST** générée automatiquement  
✅ **Authentification** intégrée  
✅ **Temps réel** avec les subscriptions  
✅ **Interface d'administration** web  
✅ **Sauvegardes automatiques**  

## Comptes de démonstration

- **Admin** : admin@befornorka.fr / admin123
- **Membre** : membre@email.com / membre123

## Support

Pour toute question concernant la configuration de la base de données, consultez la [documentation Supabase](https://supabase.com/docs).