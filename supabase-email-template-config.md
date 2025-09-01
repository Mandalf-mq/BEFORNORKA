# Configuration du template d'email Supabase pour la récupération de mot de passe

## 🎯 Problème identifié
Le template d'email HTML que vous avez créé est parfait, mais Supabase utilise son propre template par défaut qui redirige vers `/auth` au lieu de `/auth/reset-password`.

## 🔧 Solution : Configurer le template dans Supabase

### 1. Dans votre Dashboard Supabase :

1. Allez dans **Authentication** → **Email Templates**
2. Sélectionnez **"Reset Password"**
3. **Remplacez le template par défaut** par votre template HTML

### 2. Template HTML à utiliser dans Supabase :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Réinitialisation de mot de passe - BE FOR NOR KA</title>
    <style>
        /* Votre CSS existant - parfait ! */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #374151;
            background: linear-gradient(135deg, #fdf2f8 0%, #f0fdf4 50%, #fffbeb 100%);
            margin: 0;
            padding: 20px;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            border: 1px solid rgba(255, 255, 255, 0.3);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        
        .logo {
            width: 80px;
            height: 80px;
            background: white;
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            overflow: hidden;
        }
        
        .logo-fallback {
            font-size: 24px;
            font-weight: bold;
            color: #ec4899;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.9;
            font-weight: 500;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .reset-message {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .reset-message h2 {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 12px;
        }
        
        .reset-message p {
            font-size: 16px;
            color: #6b7280;
            font-weight: 500;
        }
        
        .reset-box {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border: 2px solid #3b82f6;
            border-radius: 16px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
        }
        
        .reset-button {
            display: inline-block;
            background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%);
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 10px 25px rgba(236, 72, 153, 0.3);
            transition: all 0.3s ease;
            margin: 20px 0;
        }
        
        .warning-box {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .warning-box p {
            color: #dc2626;
            font-size: 14px;
            font-weight: 500;
            margin: 0;
        }
        
        .footer {
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            padding: 30px;
            text-align: center;
            border-top: 1px solid #d1d5db;
        }
        
        .footer p {
            color: #6b7280;
            font-size: 14px;
            font-weight: 500;
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <div class="logo-fallback">🏐</div>
            </div>
            <h1>BE FOR NOR KA</h1>
            <p>Club de Volleyball affilié FFVB</p>
        </div>
        
        <div class="content">
            <div class="reset-message">
                <h2>Réinitialiser votre mot de passe 🔐</h2>
                <p>
                    Une demande de réinitialisation de mot de passe a été effectuée pour votre compte.
                    Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.
                </p>
            </div>
            
            <div class="reset-box">
                <h3 style="color: #1e40af; font-size: 20px; font-weight: 700; margin-bottom: 15px;">
                    🔑 Créer un nouveau mot de passe
                </h3>
                
                <!-- IMPORTANT: Supabase remplace automatiquement {{ .ConfirmationURL }} -->
                <a href="{{ .ConfirmationURL }}" class="reset-button">
                    Réinitialiser mon mot de passe
                </a>
                
                <p style="color: #ea580c; font-size: 14px; font-weight: 600; margin-top: 15px;">
                    ⏰ Ce lien expire dans 1 heure
                </p>
            </div>
            
            <div class="warning-box">
                <p>
                    <strong>🚨 IMPORTANT :</strong> Si vous n'avez PAS demandé cette réinitialisation, 
                    ignorez cet email et contactez l'administration.
                </p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>BE FOR NOR KA</strong></p>
            <p>Club de Volleyball affilié FFVB</p>
            <p>Le Krater - All. du Débarcadère, 97221 Le Carbet - Martinique</p>
            <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
                © 2025 BE FOR NOR KA. Tous droits réservés.
            </p>
        </div>
    </div>
</body>
</html>
```

### 3. Variables Supabase à utiliser :

Dans le template, Supabase remplace automatiquement :
- `{{ .ConfirmationURL }}` → Lien de récupération avec tokens
- `{{ .Email }}` → Email de l'utilisateur
- `{{ .SiteURL }}` → URL de votre site

## 🔧 Configuration des URLs de redirection

Dans **Authentication** → **Settings** :

**Site URL :** `https://www.befornorka.fr`

**Additional Redirect URLs :**
```
https://www.befornorka.fr/auth/reset-password
https://www.befornorka.fr/auth/confirm
https://www.befornorka.fr/*
https://befornorka.fr/auth/reset-password
https://befornorka.fr/*
```

## 🎯 Résultat attendu

Après configuration :
1. **Email envoyé** avec votre beau template
2. **Lien cliqué** → Redirige vers `/auth/reset-password` 
3. **Nouveau mot de passe** défini
4. **Connexion automatique** ✅

**Configurez le template dans Supabase et testez !** 🚀