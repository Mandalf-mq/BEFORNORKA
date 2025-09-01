# 🔧 Configuration Supabase pour résoudre les problèmes de récupération

## 🚨 Problème identifié
Les logs montrent que les tokens OTP expirent immédiatement :
- **09:15:41** - Token créé ✅
- **09:17:02** - Token introuvable ❌ (1min 21s après)

## 🎯 Solution complète

### 1. **Configuration Authentication Settings**

Dans votre **Dashboard Supabase** → **Authentication** → **Settings** :

#### **Site URL :**
```
https://www.befornorka.fr
```

#### **Additional Redirect URLs :**
```
https://www.befornorka.fr/*
https://www.befornorka.fr/auth/reset-password
https://www.befornorka.fr/auth/confirm
https://befornorka.fr/*
https://befornorka.fr/auth/reset-password
https://befornorka.fr/auth/confirm
```

### 2. **Configuration Email Templates**

**Authentication** → **Email Templates** → **Reset Password** :

Remplacez le template par défaut par :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Réinitialisation - BE FOR NOR KA</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #ec4899; font-size: 24px; margin-bottom: 10px;">🏐 BE FOR NOR KA</h1>
            <h2 style="color: #374151; font-size: 20px; margin: 0;">Réinitialiser votre mot de passe</h2>
        </div>
        
        <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <p style="color: #1e40af; font-size: 16px; margin-bottom: 20px;">
                Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :
            </p>
            
            <a href="{{ .ConfirmationURL }}" 
               style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                🔑 Réinitialiser mon mot de passe
            </a>
            
            <p style="color: #dc2626; font-size: 12px; margin-top: 15px; font-weight: bold;">
                ⏰ IMPORTANT : Cliquez IMMÉDIATEMENT sur ce lien !
            </p>
        </div>
        
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="color: #dc2626; font-size: 14px; margin: 0;">
                <strong>🚨 ATTENTION :</strong> Ce lien expire très rapidement. 
                Si vous n'avez PAS demandé cette réinitialisation, ignorez cet email.
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 5px 0;"><strong>BE FOR NOR KA</strong></p>
            <p style="color: #6b7280; font-size: 12px; margin: 0;">Club de Volleyball affilié FFVB</p>
        </div>
    </div>
</body>
</html>
```

### 3. **Configuration Security Settings**

**Authentication** → **Settings** → **Security** :

- **JWT expiry** : `3600` (1 heure)
- **Refresh token rotation** : `Enabled`
- **Session timeout** : `604800` (7 jours)

### 4. **Configuration SMTP (CRITIQUE)**

**Authentication** → **Settings** → **SMTP Settings** :

Si vous utilisez un **SMTP personnalisé**, vérifiez :
- **Serveur SMTP** configuré correctement
- **Authentification** SMTP valide
- **Rate limiting** pas trop restrictif

### 5. **Vérification des quotas**

**Settings** → **Billing** → **Usage** :

Vérifiez que vous n'avez pas dépassé :
- **Monthly Active Users** (50,000 gratuit)
- **Auth requests** par mois
- **Email sends** par mois

## 🎯 **Actions immédiates à faire :**

### **Étape 1 : Vérifier la configuration**
1. Allez dans votre **Dashboard Supabase**
2. **Authentication** → **Settings**
3. Vérifiez que **Site URL** = `https://www.befornorka.fr`
4. Ajoutez TOUTES les **Additional Redirect URLs** listées ci-dessus

### **Étape 2 : Mettre à jour le template email**
1. **Authentication** → **Email Templates** → **Reset Password**
2. Remplacez par le template HTML ci-dessus
3. **IMPORTANT** : Gardez `{{ .ConfirmationURL }}` tel quel

### **Étape 3 : Tester immédiatement**
1. Demandez un nouveau lien de récupération
2. Cliquez **IMMÉDIATEMENT** sur le lien dans l'email
3. Ne copiez/collez **JAMAIS** l'URL manuellement

## 🚨 **Si ça ne marche toujours pas :**

C'est une **limitation du plan Supabase gratuit**. Solutions :

1. **Upgrade vers plan Pro** (25$/mois)
2. **Utiliser l'admin** pour recréer le compte
3. **Import CSV** avec nouveaux identifiants

**Le problème est côté serveur Supabase - votre code est correct !** 🎯