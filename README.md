# FacturePro

Devis, factures et acomptes en ligne.

## Fonctionnalités

- Devis et factures (complète, acompte, solde) avec calcul auto HT/TVA/TTC
- PDF avec logo entreprise et mentions légales adaptées (franchise en base / TVA / crédit d'impôt SAP)
- Envoi du devis par email au client (Brevo) avec page de consultation publique et acceptation en ligne
- Envoi de facture par email avec PDF en pièce jointe
- Statut "en retard" automatique + relances par email (manuelles ou automatiques une fois par jour)
- Paiement d'acompte ou paiement complet via lien Stripe, confirmé **automatiquement** par webhook (plus besoin de cocher "reçu" à la main)
- Duplication de devis/factures existants
- Recherche et filtres sur les listes de devis/factures
- Factures d'achat, notes de frais, factures récurrentes
- Tableau de bord avec graphique de chiffre d'affaires et statuts cliquables

## Migrations SQL à exécuter (dans l'ordre, si pas déjà fait)

Dans Supabase → **SQL Editor** :

1. `supabase/schema.sql` — uniquement si tu pars d'un projet Supabase vide
2. `supabase/migration_acompte_credit_impot.sql`
3. `supabase/migration_achats_frais_recurrentes.sql`
4. `supabase/migration_logo_storage.sql`
5. `supabase/migration_relances.sql`
6. `supabase/migration_stripe_connect.sql`

## Variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Où la trouver |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → Secret keys (⚠️ jamais dans le frontend) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Voir section webhook ci-dessous |
| `BREVO_API_KEY` | Brevo → SMTP & API → API Keys |
| `CRON_SECRET` | Une chaîne aléatoire que tu inventes toi-même (protège les relances automatiques) |

Après avoir ajouté/modifié des variables, redéploie (Vercel → Deployments → ⋯ → Redeploy).

## Relances automatiques des factures en retard

Une fois par jour (8h UTC, soit 9h ou 10h en France selon l'heure d'été), Vercel exécute automatiquement `/api/send-reminders`, qui :
1. Passe en statut "en retard" toutes les factures dont l'échéance est dépassée
2. Envoie un email de relance à chaque facture en retard, au maximum une fois tous les 7 jours par facture (pour ne pas harceler tes clients)

C'est déjà actif dès que le fichier `vercel.json` est déployé — rien à configurer en plus, à part `CRON_SECRET` (recommandé mais pas obligatoire) et bien sûr `BREVO_API_KEY`.

Tu peux aussi relancer une facture précise manuellement à tout moment, via le bouton "Relancer par email" qui apparaît sur une facture en retard.

## Stripe Connect (pour revendre FacturePro à d'autres entreprises)

Sans Stripe Connect, tous les paiements clients arrivent sur **ton** compte Stripe — ça ne marche que tant que tu es le seul utilisateur. Stripe Connect permet à chaque entreprise qui utilise FacturePro de connecter son propre compte Stripe : l'argent de ses clients va directement chez elle.

**Configuration côté Stripe (une seule fois) :**

1. Va sur [dashboard.stripe.com](https://dashboard.stripe.com) → **Connect** dans le menu (si tu ne le vois pas, cherche "Paramètres Connect" ou active Connect depuis les paramètres de la plateforme)
2. Configure les infos de base de ta plateforme (nom, logo — c'est ce que verront tes futurs clients pendant l'onboarding Stripe)
3. Dans **Webhooks**, crée une **deuxième destination** (en plus de celle déjà créée pour ton propre compte) :
   - URL : `https://TON-SITE.vercel.app/api/stripe-webhook` (la même URL que l'autre)
   - **Périmètre : "Comptes connectés"** (pas "Votre compte")
   - Événement à écouter : `checkout.session.completed`
4. Copie le **Signing secret** de cette nouvelle destination → colle-le dans `STRIPE_CONNECT_WEBHOOK_SECRET` sur Vercel
5. Redéploie

**Utilisation :**

Chaque entreprise (toi y compris) va dans **Paramètres → Paiements en ligne** et clique **"Connecter mon compte Stripe"**. Ça ouvre le formulaire d'inscription Stripe (infos bancaires, identité). Une fois complété, le statut passe à "Compte Stripe connecté et actif", et tous les prochains liens de paiement générés sur les factures de cette entreprise vont sur son propre compte Stripe.

**Note de sécurité importante avant d'ouvrir FacturePro à d'autres personnes :** actuellement, `api/stripe-connect-onboard.js` fait confiance à l'identifiant d'entreprise envoyé par le frontend, sans vérifier que la personne qui appelle est bien connectée et propriétaire de cette entreprise. Tant que tu es seul utilisateur, ce n'est pas un risque. Avant de vendre l'accès à d'autres, il faudra ajouter une vérification du token de session Supabase dans cette fonction — dis-le-moi quand tu en es là, c'est une modification rapide à faire.

## Configurer le webhook Stripe (paiement automatique)

1. Va sur [dashboard.stripe.com](https://dashboard.stripe.com) → **Developers → Webhooks → Add endpoint**
2. URL du endpoint : `https://TON-SITE.vercel.app/api/stripe-webhook`
3. Événement à écouter : `checkout.session.completed`
4. Une fois créé, Stripe affiche une **Signing secret** (commence par `whsec_...`) → copie-la dans `STRIPE_WEBHOOK_SECRET` sur Vercel
5. Redéploie

Sans ce webhook, tout continue de fonctionner — tu devras juste cliquer manuellement sur "Marquer comme reçu" après avoir vérifié le paiement dans ton dashboard Stripe.

## Configurer Brevo pour l'envoi d'email

1. Sur [Brevo](https://app.brevo.com), va dans **Paramètres → Expéditeurs et IP → Expéditeurs**
2. Ajoute et **valide** l'adresse email que tu utilises comme email de contact dans les Paramètres de FacturePro (Brevo refuse d'envoyer depuis une adresse non vérifiée)
3. Récupère ta clé API dans **SMTP & API → API Keys** → colle-la dans `BREVO_API_KEY` sur Vercel

## Logo entreprise

Va dans **Paramètres** dans l'app une fois connecté → upload ton logo (PNG/JPG). Il apparaît automatiquement sur tes PDF et sur la page de consultation publique des devis.

## Stack technique

React + Vite, Supabase (base de données + auth + RLS + storage), Stripe (paiement), Brevo (email), jsPDF (génération PDF côté client). Même famille technique que CleanNet/BookPro.
