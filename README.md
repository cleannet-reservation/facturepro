# FacturePro

Devis, factures et acomptes en ligne.

## Fonctionnalités

- Devis et factures (complète, acompte, solde) avec calcul auto HT/TVA/TTC
- PDF avec logo entreprise et mentions légales adaptées (franchise en base / TVA / crédit d'impôt SAP)
- Envoi du devis par email au client (Brevo) avec page de consultation publique et acceptation en ligne
- Paiement d'acompte via lien Stripe, confirmé **automatiquement** par webhook (plus besoin de cocher "reçu" à la main)
- Factures d'achat, notes de frais, factures récurrentes
- Tableau de bord avec graphique de chiffre d'affaires

## Migrations SQL à exécuter (dans l'ordre, si pas déjà fait)

Dans Supabase → **SQL Editor** :

1. `supabase/schema.sql` — uniquement si tu pars d'un projet Supabase vide
2. `supabase/migration_acompte_credit_impot.sql`
3. `supabase/migration_achats_frais_recurrentes.sql`
4. `supabase/migration_logo_storage.sql`

## Variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Où la trouver |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → Secret keys (⚠️ jamais dans le frontend) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Voir section webhook ci-dessous |
| `BREVO_API_KEY` | Brevo → SMTP & API → API Keys |

Après avoir ajouté/modifié des variables, redéploie (Vercel → Deployments → ⋯ → Redeploy).

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
