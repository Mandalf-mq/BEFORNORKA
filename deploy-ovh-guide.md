# 🚀 Guide de déploiement OVH avec GitHub - BE FOR NOR KA v1.2.0

## 📋 Prérequis
- ✅ Hébergement web OVH actif
- ✅ Repository GitHub avec votre code
- ✅ Accès FTP à votre hébergement OVH
- ✅ Projet Supabase configuré
- ✅ Domaine configuré sur OVH

## 🤖 Méthode 1 : Déploiement automatique avec GitHub Actions (RECOMMANDÉ)

### Avantages
- 🚀 **Déploiement automatique** à chaque commit
- 🔄 **Pas de manipulation manuelle**
- 📊 **Logs détaillés** des déploiements
- ⏰ **Gain de temps** énorme
- 🛡️ **Sécurisé** avec secrets GitHub

### Configuration GitHub

#### 1. Secrets à ajouter dans GitHub
Dans votre repository → **Settings** → **Secrets and variables** → **Actions** :

```
OVH_FTP_HOST=ftp.votre-domaine.com
OVH_FTP_USER=votre-login-ftp-ovh
OVH_FTP_PASSWORD=votre-mot-de-passe-ftp
VITE_SUPABASE_URL=https://gwzgoyfoinrmpnksdbtx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 2. Workflow automatique
Le fichier `.github/workflows/deploy-ovh.yml` est **déjà inclus** dans votre projet !

#### 3. Déclenchement
- **Push sur main/master** → Déploiement automatique
- **Déploiement manuel** via l'onglet Actions de GitHub

### Comment ça marche
1. 📝 Vous commitez votre code sur GitHub
2. 🤖 GitHub Actions détecte le push
3. 🏗️ Build automatique de l'application
4. 📤 Upload automatique vers OVH via FTP
5. 🌐 Site mis à jour instantanément !

---

## 🔧 Méthode 2 : Déploiement manuel

## 🔧 Étape 1 : Configuration des variables d'environnement

### Le fichier .env.production est déjà configuré
Vérifiez que vos vraies valeurs Supabase sont dans `.env.production` :

```env
VITE_SUPABASE_URL=https://gwzgoyfoinrmpnksdbtx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NODE_ENV=production
```

## 🏗️ Étape 2 : Build de l'application

### Commandes à exécuter localement :
```bash
# 1. Cloner depuis GitHub
git clone https://github.com/votre-username/votre-repo.git
cd votre-repo

# 2. Installer les dépendances
npm install

# 3. Compiler pour la production
npm run build:prod

# 4. Vérifier que le dossier 'dist' est créé
ls dist/
```

Le dossier `dist/` contiendra tous les fichiers optimisés pour la production.

## 📤 Étape 3 : Upload vers OVH

### Via FileZilla (recommandé) :
1. **Host** : `ftp.votre-domaine.com`
2. **Username** : votre login FTP OVH
3. **Password** : votre mot de passe FTP
4. **Port** : 21

### Fichiers à uploader :
Uploadez **tout le contenu** du dossier `dist/` vers la racine de votre hébergement :

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── logo b4NK.png
├── vite.svg
└── .htaccess
```

## 🌐 Étape 4 : Configuration du domaine sur OVH

### Dans l'espace client OVH :
1. **Web Cloud** > **Hébergements** > **Multisite**
2. Configurez votre domaine pour pointer vers le dossier racine
3. Activez HTTPS si ce n'est pas déjà fait

## 🔄 Workflow de développement recommandé

### 1. Développement sur Bolt.new
- Développez et testez vos fonctionnalités
- Utilisez l'environnement de développement

### 2. Commit sur GitHub
```bash
git add .
git commit -m "✨ Nouvelle fonctionnalité"
git push origin main
```

### 3. Déploiement automatique
- GitHub Actions se déclenche automatiquement
- Build et déploiement vers OVH
- Site mis à jour en 2-3 minutes !

### 4. Vérification
- Vérifiez que le site fonctionne sur votre domaine
- Testez les fonctionnalités critiques

## 🛡️ Sécurité et bonnes pratiques

### Variables d'environnement
- ✅ **Jamais de secrets** dans le code
- ✅ **GitHub Secrets** pour les données sensibles
- ✅ **Fichiers .env** ignorés par Git

### Branches
- `main/master` → Production
- `develop` → Développement/Test
- `feature/*` → Nouvelles fonctionnalités

### Monitoring
- 📊 **Logs GitHub Actions** pour les déploiements
- 🔍 **Logs OVH** dans l'espace client
- 📧 **Notifications** en cas d'échec

## 🔄 Étape 6 : Configuration Supabase pour la production

### Dans votre dashboard Supabase :
1. **Authentication** > **Settings**
2. **Site URL** : `https://votre-domaine.com` (remplacez par votre vrai domaine)
3. **Additional Redirect URLs** :
   ```
   https://votre-domaine.com/auth/confirm
   https://votre-domaine.com/auth/reset-password
   https://votre-domaine.com/*
   https://bolt.new/*
   https://*.bolt.new/*
   ```

## 🎯 Avantages du déploiement GitHub + OVH

### ✅ **Automatisation complète**
- Déploiement en 1 clic (push sur GitHub)
- Pas de manipulation FTP manuelle
- Historique des déploiements

### ✅ **Collaboration facilitée**
- Plusieurs développeurs peuvent contribuer
- Gestion des versions avec Git
- Revue de code avec Pull Requests

### ✅ **Fiabilité**
- Rollback facile en cas de problème
- Tests automatiques avant déploiement
- Logs détaillés de chaque étape

### ✅ **Sécurité**
- Secrets protégés dans GitHub
- Variables d'environnement sécurisées
- Pas de credentials dans le code

## ✅ Étape 8 : Vérification du déploiement

### Tests à effectuer :
1. **Accès au site** : `https://votre-domaine.com` ✅
2. **Inscription** : Tester la création de compte
3. **Connexion** : Tester l'authentification
4. **Navigation** : Vérifier que toutes les pages fonctionnent
5. **Documents** : Tester l'upload et téléchargement
6. **WhatsApp** : Tester la génération de sondages
7. **Entraînements** : Tester les confirmations de présence

## 🔧 Configuration avancée

### Déploiement multi-environnements

Vous pouvez configurer plusieurs environnements :

```yaml
# Production : main branch → votre-domaine.com
# Staging : develop branch → test.votre-domaine.com
```

### Notifications Discord/Slack

Ajoutez des webhooks pour être notifié des déploiements :

```yaml
- name: 📢 Notify Discord
  if: always()
  uses: sarisia/actions-status-discord@v1
  with:
    webhook: ${{ secrets.DISCORD_WEBHOOK }}
```

### Tests automatiques

Ajoutez des tests avant déploiement :

```yaml
- name: 🧪 Run tests
  run: npm run test:run
  
- name: 🔍 Type check
  run: npm run type-check
```

## 🐛 Résolution des problèmes courants

### Erreur de déploiement GitHub Actions
- Vérifiez que tous les **secrets sont configurés**
- Vérifiez les **permissions FTP** OVH
- Consultez les **logs détaillés** dans l'onglet Actions

### Build qui échoue
- Vérifiez que `npm run build:prod` fonctionne en local
- Vérifiez les **variables d'environnement**
- Consultez les erreurs TypeScript/ESLint

### Erreur 404 sur les routes
- ✅ Le fichier `.htaccess` est **déjà configuré** et sera uploadé automatiquement
- Vérifiez que mod_rewrite est activé sur votre hébergement OVH

### Erreurs CORS avec Supabase
- ✅ Ajoutez votre domaine OVH dans **Authentication → Settings**
- ✅ Configurez les **Additional Redirect URLs**
- ✅ Attendez 1-2 minutes après la configuration

### Variables d'environnement non reconnues
- ✅ Utilisez `npm run build:prod` (pas `npm run build`)
- ✅ Vérifiez que `.env.production` contient vos vraies valeurs
- ✅ Les secrets GitHub sont correctement configurés

## 🎉 Résultat final

Une fois configuré, vous aurez :

### 🔄 **Workflow automatisé**
1. Vous développez sur Bolt.new
2. Vous commitez sur GitHub
3. GitHub Actions déploie automatiquement sur OVH
4. Votre site est mis à jour !

### 📊 **Monitoring**
- Logs de déploiement dans GitHub Actions
- Historique des versions
- Rollback facile si problème

### 🚀 **Performance**
- Site optimisé pour la production
- Compression GZIP activée
- Cache des assets configuré

## 📞 Support

Si vous rencontrez des problèmes :
1. **GitHub Actions** : Consultez l'onglet Actions de votre repo
2. **OVH** : Vérifiez les logs dans l'espace client
3. **Local** : Testez avec `npm run preview:prod`
4. **Browser** : Vérifiez la console pour les erreurs JavaScript
5. **Supabase** : Vérifiez la configuration CORS

---

**🎯 Avec cette configuration, votre site sera déployé automatiquement à chaque modification !**