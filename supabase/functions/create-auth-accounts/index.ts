import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase admin client
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

    const { accounts } = await req.json()

    if (!accounts || !Array.isArray(accounts)) {
      throw new Error('Format de données invalide')
    }

    const results = []
    let successCount = 0
    let errorCount = 0

    // Récupérer la saison courante
    const { data: currentSeason } = await supabaseAdmin
      .from('seasons')
      .select('id')
      .eq('is_current', true)
      .single()

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

        // Validation des données
        if (!first_name || !last_name || !email) {
          results.push({
            email,
            success: false,
            error: 'Champs obligatoires manquants'
          })
          errorCount++
          continue
        }

        // Générer un mot de passe fort
        const generateStrongPassword = () => {
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

        const temporaryPassword = generateStrongPassword();

        // 1. Créer l'utilisateur dans auth.users avec l'API admin (PAS DE RATE LIMIT)
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true, // Confirmer l'email automatiquement
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
            error: `Erreur auth: ${authError.message}`
          })
          errorCount++
          continue
        }

        // 2. Créer l'entrée dans la table users
        const { error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authUser.user.id,
            email,
            first_name,
            last_name,
            phone: phone || null,
            role: role,
            is_active: true
          })

        if (userError) {
          console.warn('Erreur création profil utilisateur:', userError)
          // Ne pas bloquer pour cette erreur
        }

        // 3. Si c'est un membre, créer aussi le profil membre
        let newMemberId = null
        if (role === 'member') {
          // Créer le profil membre
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
            console.warn('Erreur création profil membre:', memberError)
          } else {
            newMemberId = newMember.id
            
            // Ajouter la catégorie principale
            await supabaseAdmin
              .from('member_categories')
              .insert({
                member_id: newMember.id,
                category_value: category,
                is_primary: true
              })
          }
        }

        results.push({
          email,
          success: true,
          user_id: authUser.user.id,
          member_id: newMemberId,
          temporary_password: temporaryPassword,
          role: role
        })
        successCount++

      } catch (error) {
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
        success: true,
        total_processed: accounts.length,
        success_count: successCount,
        error_count: errorCount,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Erreur Edge Function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})