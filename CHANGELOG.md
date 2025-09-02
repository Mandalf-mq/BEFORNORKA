# Changelog - BE FOR NOR KA

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

## [1.2.1] - 2025-01-23

### Corrigé
- 🐛 **Erreur upload documents** : Correction de l'incohérence entre types de documents frontend/backend
- 🐛 **Progression workflow à 0%** : Calcul de progression basé sur les vrais documents du membre
- 🐛 **Détails workflow incorrects** : Statut et documents requis reflètent maintenant la réalité
- 🐛 **Problème fuseau horaire** : Entraînements s'affichent au bon jour (lundi reste lundi)
- 🔧 **Types de documents** : Utilisation cohérente des anciens noms (`ffvbForm`, `medicalCertificate`, etc.)
- 🔧 **Modal workflow** : Chargement correct des documents du membre sélectionné
- 🔧 **Calcul progression** : Basé sur l'âge réel (4-5 documents selon mineur/majeur)

### Ajouté
- ✨ **Bouton "Annuler validation"** : Possibilité de remettre un document en attente
- ✨ **Actions bidirectionnelles** : Valider ↔ Rejeter ↔ En attente pour les documents
- 📊 **Progression dynamique** : 25% profil + 25% upload + 50% validation
- 🔍 **Debugging amélioré** : Logs détaillés pour identifier les problèmes
- 📅 **Gestion fuseau horaire** : Dates cohérentes dans tous les affichages

### Modifié
- 🔄 **Workflow de validation** : Interface plus intuitive avec vraies données
- 📊 **Calcul progression** : Basé sur les documents réellement uploadés/validés
- 🎯 **Prochaine étape** : Messages contextuels selon la situation réelle
- 📅 **Affichage dates** : Correction du décalage UTC → heure locale
- 🏷️ **Types de documents** : Cohérence totale entre frontend et backend

### Technique
- 🔧 **Correction types documents** : Utilisation des anciens noms pour compatibilité
- 📊 **Fonction calculateMemberProgress** : Calcul basé sur `selectedMemberDocs`
- 🕐 **Gestion dates** : Ajout de `T00:00:00` pour éviter les décalages UTC
- 🔍 **Logs debugging** : Identification des problèmes de chargement documents
- 🎯 **Actions workflow** : Gestion bidirectionnelle des validations

## [1.2.0] - 2025-01-23

### Corrigé
- 🐛 **Erreur "Object not found"** : Correction du système de stockage des modèles de documents
- 🐛 **Erreur "gwzgoyfoinrmpnksdbtx.supabase.co n'autorise pas la connexion"** : Guide de configuration CORS
- 🔧 **Types de documents incohérents** : Migration complète vers les nouveaux noms standardisés
- 🔧 **Modèles inaccessibles** : Création de modèles par défaut avec URLs externes
- 🔧 **Catégories invalides** : Nettoyage et synchronisation des catégories membres
- 🔧 **Fonction WhatsApp** : Correction définitive avec support catégories multiples

### Ajouté
- 📱 **Réponse "Peut-être"** aux entraînements (en plus de Présent/Absent)
- 🤖 **Système de sondage WhatsApp automatique** avec programmation
- 📊 **Statistiques d'engagement WhatsApp** et suivi des réponses
- 📥 **Import CSV avec création de comptes** et envoi d'identifiants
- 🏗️ **Buckets de stockage Supabase** configurés automatiquement
- 📋 **Modèles de documents par défaut** avec URLs officielles
- 🔧 **Fonctions de diagnostic** pour identifier les problèmes
- 📱 **Templates WhatsApp intelligents** avec variables dynamiques
- 🎯 **Validation automatique des numéros** de téléphone français

### Modifié
- 🔄 **Noms de documents standardisés** : `registration_form`, `medical_certificate`, `photo`, `parental_authorization`, `identity_copy`
- 📱 **Interface WhatsApp améliorée** avec prévisualisation style WhatsApp
- 🎨 **Affichage des catégories** avec badges visuels et hiérarchie
- 📊 **Dashboard enrichi** avec statistiques détaillées et diagnostics
- 🔧 **Gestion des erreurs** améliorée avec messages explicites
- 📱 **Compatibilité mobile** optimisée pour tous les écrans
- 🎯 **Workflow de validation** simplifié et plus intuitif

### Technique
- 🗄️ **Migration des types de documents** vers noms standardisés
- 🔧 **Fonctions PostgreSQL** pour import CSV et création de comptes
- 📱 **Système de sondages WhatsApp** avec base de données dédiée
- 🛡️ **Buckets de stockage** avec permissions appropriées
- 🔍 **Fonctions de diagnostic** pour troubleshooting
- 📊 **Statistiques temps réel** avec subscriptions Supabase
- 🎯 **Validation des données** renforcée côté serveur

### Sécurité
- 🔒 **Configuration CORS** documentée pour Supabase
- 🛡️ **Politiques RLS** sur toutes les nouvelles tables
- 🔐 **Validation des uploads** avec types MIME autorisés
- 📧 **Gestion des identifiants** temporaires sécurisés

## [1.1.0] - 2025-01-19

### Corrigé
- 🐛 **Erreur de redirection** : Les membres arrivent maintenant directement sur "Mes Entraînements"
- 🐛 **Erreur "data is not defined"** dans la liste des membres
- 🐛 **Erreur "column reference id is ambiguous"** dans WhatsApp Manager
- 🔧 **Fonction get_members_for_whatsapp** corrigée avec aliases explicites

### Ajouté
- 👥 **Système de catégories multiples** pour les membres
- 🏷️ **Catégorie principale** + catégories supplémentaires
- 📋 **Interface de sélection multiple** dans les formulaires
- 🎨 **Affichage visuel** des catégories avec badges
- 🔧 **Table member_categories** pour la liaison many-to-many
- 📊 **Support des catégories multiples** dans WhatsApp Manager

### Modifié
- 🔄 **Navigation par défaut** : Membres → "Mes Entraînements" au lieu de "Mes Documents"
- 🎯 **Logique de redirection** simplifiée et plus robuste
- 📝 **Formulaire d'ajout membre** avec sélection de catégories multiples
- 👤 **Profil membre** affiche toutes les catégories
- 📋 **Liste des membres** montre catégorie principale + supplémentaires

### Technique
- 🗄️ **Migration SQL** pour corriger la fonction WhatsApp
- 🔧 **Composant ProfileCategoriesDisplay** pour l'affichage des catégories
- 📱 **Fonction MultiCategorySelector** pour la sélection multiple
- 🛠️ **Fonctions utilitaires** pour la gestion des catégories multiples

## [1.0.0] - 2024-12-26

### Ajouté
- 🏐 **Système d'inscription** complet pour les membres
- 📄 **Gestion des documents** (formulaires FFVB, certificats médicaux, etc.)
- 📅 **Calendrier des entraînements** avec confirmation de présence
- 👨‍💼 **Tableau de bord administrateur** pour la validation des dossiers
- 👨‍🏫 **Interface entraîneur** pour la gestion des présences
- 📱 **Notifications WhatsApp** pour les appels d'entraînement
- 🏆 **Gestion des saisons** sportives
- 💰 **Système de cotisations** configurable
- 👥 **Gestion des rôles** (Webmaster, Admin, Trésorerie, Entraîneur)
- 🔐 **Authentification sécurisée** avec Supabase
- 📧 **Système d'emails** (confirmation, récupération mot de passe)

### Technique
- ⚛️ **React 18** avec TypeScript
- 🎨 **Tailwind CSS** pour le design
- 🗄️ **Supabase** pour la base de données et l'authentification
- 🔒 **Row Level Security** (RLS) pour la sécurité des données
- 📱 **Design responsive** pour mobile et desktop
- 🚀 **Optimisé pour le déploiement** sur hébergement web

### Sécurité
- 🔐 **Authentification par email/mot de passe**
- 🛡️ **Politiques RLS** pour protéger les données
- 🔑 **Gestion des permissions** par rôle
- 📧 **Validation par email** obligatoire
- 🔄 **Récupération de mot de passe** sécurisée

---

## Format de versioning

Ce projet suit le [Semantic Versioning](https://semver.org/):
- **MAJOR** : Changements incompatibles
- **MINOR** : Nouvelles fonctionnalités compatibles
- **PATCH** : Corrections de bugs compatibles

## Types de changements

- **Ajouté** : Nouvelles fonctionnalités
- **Modifié** : Changements dans les fonctionnalités existantes
- **Déprécié** : Fonctionnalités qui seront supprimées
- **Supprimé** : Fonctionnalités supprimées
- **Corrigé** : Corrections de bugs
- **Sécurité** : Corrections de vulnérabilités