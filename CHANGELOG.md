# Changelog - BE FOR NOR KA

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

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