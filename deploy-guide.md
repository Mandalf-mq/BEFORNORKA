# 🚀 Guide de déploiement sur OVH Web Hosting

## 📋 Prérequis
- Hébergement web OVH actif
- Accès FTP à votre hébergement
- Base de données Supabase configurée
- Domaine configuré sur OVH

## 🔧 Étape 1 : Configuration des variables d'environnement

### Créer le fichier de production
Créez un fichier `.env.production` avec vos vraies valeurs Supabase :

```env
VITE_SUPABASE_URL=https://gwzgoyfoinrmpnksdbtx.supabase.co
VITE_SUPABASE_ANON_KEY=votre-vraie-clé-anon
```

## 🏗️ Étape 2 : Compilation pour la production

### Commandes à exécuter localement :
```bash
# 1. Installer les dépendances (si pas déjà fait)
npm install

# 2. Compiler pour la production
npm run build

# 3. Vérifier que le dossier 'dist' est créé
ls dist/
```

## 📁 Étape 3 : Structure des fichiers à uploader

Après `npm run build`, vous devez uploader le contenu du dossier `dist/` :

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── logo b4NK.png
└── vite.svg
```

## 🌐 Étape 4 : Configuration du domaine sur OVH

### Dans l'espace client OVH :
1. Allez dans **Web Cloud** > **Hébergements**
2. Sélectionnez votre hébergement
3. Onglet **Multisite**
4. Configurez votre domaine pour pointer vers le dossier racine

## 📤 Étape 5 : Upload via FTP

### Méthode 1 : FileZilla (Recommandée)
```
Hôte : ftp.votre-domaine.com (ou ftp.cluster0XX.hosting.ovh.net)
Utilisateur : votre-login-ftp
Mot de passe : votre-mot-de-passe-ftp
Port : 21
```

### Méthode 2 : Interface web OVH
1. Connectez-vous à l'espace client OVH
2. **Web Cloud** > **Hébergements** > **FTP-SSH**
3. **Explorateur FTP** > Uploader les fichiers

## 🔄 Étape 6 : Configuration Supabase pour la production

### Dans votre dashboard Supabase :
1. **Authentication** > **Settings**
2. **Site URL** : `https://votre-domaine.com`
3. **Additional Redirect URLs** :
   ```
   https://votre-domaine.com/auth/confirm
   https://votre-domaine.com/auth/reset-password
   https://votre-domaine.com/*
   ```

## 🔧 Étape 7 : Configuration .htaccess pour SPA

Créez un fichier `.htaccess` dans le dossier racine de votre site :

```apache
# Redirection pour Single Page Application
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Gestion des fichiers statiques
  RewriteRule ^assets/ - [L]
  RewriteRule ^vite\.svg$ - [L]
  RewriteRule ^logo\ b4NK\.png$ - [L]
  
  # Redirection vers index.html pour toutes les autres routes
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Configuration des headers de sécurité
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options nosniff
  Header always set X-Frame-Options DENY
  Header always set X-XSS-Protection "1; mode=block"
</IfModule>

# Compression GZIP
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/plain
  AddOutputFilterByType DEFLATE text/html
  AddOutputFilterByType DEFLATE text/xml
  AddOutputFilterByType DEFLATE text/css
  AddOutputFilterByType DEFLATE application/xml
  AddOutputFilterByType DEFLATE application/xhtml+xml
  AddOutputFilterByType DEFLATE application/rss+xml
  AddOutputFilterByType DEFLATE application/javascript
  AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache des fichiers statiques
<IfModule mod_expires.c>
  ExpiresActive on
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
```

## ✅ Étape 8 : Vérification du déploiement

### Tests à effectuer :
1. **Accès au site** : `https://votre-domaine.com`
2. **Inscription** : Tester la création de compte
3. **Connexion** : Tester l'authentification
4. **Navigation** : Vérifier que toutes les pages fonctionnent
5. **Base de données** : Tester l'ajout d'un membre

## 🐛 Résolution des problèmes courants

### Erreur 404 sur les routes
- Vérifiez que le fichier `.htaccess` est bien uploadé
- Vérifiez que mod_rewrite est activé sur votre hébergement OVH

### Erreurs CORS avec Supabase
- Vérifiez les URLs dans les paramètres Supabase
- Assurez-vous que votre domaine est bien configuré

### Variables d'environnement non reconnues
- Vérifiez que le build a bien utilisé les bonnes variables
- Recompilez avec `npm run build`

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez les logs dans l'espace client OVH
2. Testez d'abord en local avec `npm run preview`
3. Vérifiez la console du navigateur pour les erreurs JavaScript
</parameter>