import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 🔧 CORRECTION: Support des deux formats
    const body = await req.json()
    const accounts = body.accounts || body.members || []
    const createAccounts = body.create_accounts !== false

    console.log(`🚀 Traitement de ${accounts.length} comptes, création auth: ${createAccounts}`)

    if (!accounts || !Array.isArray(accounts)) {
      throw new Error('Format de données invalide - accounts/members array requis')
    }

    const results = []
    let successCount = 0
    let errorCount = 0

    // Récupérer la saison courante
    const { data: currentSeason, error: seasonError } = await supabaseAdmin
      .from('seasons')
      .select('id')
      .eq('is_current', true)
      .single()

    if (seasonError) {
      console.warn('Aucune saison courante trouvée:', seasonError)
    }

    // Fonction pour générer un mot de passe ultra-fort
    const generateUltraStrongPassword = () => {
      const lowercase = 'abcdefghijkmnpqrstuvwxyz';
      const uppercase = 'ABCDEFGHJKMNPQRSTUVWXYZ';
      const numbers = '23456789';
      const specials = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      let password = '';
      
      // Garantir au moins un caractère de chaque type
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      password += numbers[Math.floor(Math.random() * numbers.length)];
      password += specials[Math.floor(Math.random() * specials.length)];
      
      // Compléter avec 8 caractères supplémentaires
      const allChars = lowercase + uppercase + numbers + specials;
      for (let i = 4; i < 12; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
      }
      
      // Mélanger le mot de passe
      return password.split('').sort(() => Math.random() - 0.5).join('');
    };

    // Traiter chaque compte
    for (const account of accounts) {
      try {
        const { 
          first_name, 
          last_name, 
          email, 
          phone, 
          birth_date, 
          category = 'loisirs',
          membership_fee = 200,
          role = 'member'
        } = account

        // Validation des données obligatoires
        if (!first_name || !last_name || !email) {
          results.push({
            email: email || 'Email manquant',
            success: false,
            error: 'Champs obligatoires manquants (prénom, nom, email)'
          })
          errorCount++
          continue
        }

        // Validation format email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          results.push({
            email,
            success: false,
            error: 'Format email invalide'
          })
          errorCount++
          continue
        }

        // 🔍 Vérifier si l'email existe déjà
        const { data: existingMember, error: checkError } = await supabaseAdmin
          .from('members')
          .select('id, email')
          .eq('email', email)
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError
        }

        if (existingMember) {
          results.push({
            email,
            success: false,
            error: 'Email existe déjà dans les membres'
          })
          errorCount++
          continue
        }

        let temporaryPassword = null
        let authUserId = null

        // 🔐 Créer le compte d'authentification si demandé
        if (createAccounts) {
          temporaryPassword = generateUltraStrongPassword()

          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: temporaryPassword,
            email_confirm: true,
            user_metadata: {
              first_name,
              last_name,
              role,
              phone: phone || null
            }
          })

          if (authError) {
            results.push({
              email,
              success: false,
              error: `Erreur authentification: ${authError.message}`
            })
            errorCount++
            continue
          }

          authUserId = authUser.user.id
          console.log(`✅ Compte auth créé pour: ${email}`)

          // Créer l'entrée dans la table users
          await supabaseAdmin
            .from('users')
            .insert({
              id: authUserId,
              email,
              first_name,
              last_name,
              phone: phone || null,
              role: role,
              is_active: true
            })
        }

        // 👤 Créer le profil membre
        const { data: newMember, error: memberError } = await supabaseAdmin
          .from('members')
          .insert({
            first_name,
            last_name,
            email,
            phone: phone || null,
            birth_date: birth_date || null,
            category: category,
            membership_fee: membership_fee,
            status: 'pending',
            payment_status: 'pending',
            season_id: currentSeason?.id
          })
          .select('id')
          .single()

        if (memberError) {
          throw new Error(`Erreur création membre: ${memberError.message}`)
        }

        // Ajouter la catégorie principale
        await supabaseAdmin
          .from('member_categories')
          .insert({
            member_id: newMember.id,
            category_value: category,
            is_primary: true
          })

        results.push({
          email,
          success: true,
          user_id: authUserId,
          member_id: newMember.id,
          temporary_password: temporaryPassword,
          role: role,
          name: `${first_name} ${last_name}`
        })
        successCount++

        console.log(`✅ ${createAccounts ? 'Compte complet' : 'Membre'} créé pour: ${email}`)

      } catch (error) {
        console.error(`❌ Erreur pour ${account.email}:`, error)
        results.push({
          email: account.email || 'Email manquant',
          success: false,
          error: error.message
        })
        errorCount++
      }
    }

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        total_processed: accounts.length,
        success_count: successCount,
        error_count: errorCount,
        results,
        message: `Traitement terminé: ${successCount} réussis, ${errorCount} erreurs`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Erreur Edge Function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        total_processed: 0,
        success_count: 0,
        error_count: 1
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
