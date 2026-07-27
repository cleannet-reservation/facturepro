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
6. `supabase/migration_stripe_cle_directe.sql`

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

## Paiements par entreprise (clé Stripe directe, pour revendre FacturePro à d'autres)

Sans configuration, tous les paiements clients arrivent sur **ton** compte Stripe (celui de `STRIPE_SECRET_KEY`) — ça ne marche que tant que tu es le seul utilisateur.

Pour qu'une entreprise reçoive l'argent de ses propres clients, elle va dans **Paramètres → Paiements en ligne** dans FacturePro, et colle sa **propre clé secrète Stripe** (récupérée sur son compte Stripe personnel, gratuit à créer). Un bouton "Tester la clé" vérifie qu'elle est valide avant de l'enregistrer.

**Pour que ses factures passent en "payée" automatiquement** (sans clic manuel), elle doit en plus :
1. Copier l'URL de webhook affichée dans Paramètres (unique à son entreprise)
2. Aller sur son compte Stripe → Webhooks → créer un endpoint avec cette URL, événement `checkout.session.completed`
3. Copier le "Signing secret" fourni par Stripe → le coller dans Paramètres → "Enregistrer ce secret webhook"

Sans cette dernière étape, tout fonctionne quand même — juste avec une confirmation manuelle ("Marquer comme reçu/soldée") au lieu d'automatique.

**Note de sécurité avant d'ouvrir FacturePro à d'autres personnes payantes :** les clés Stripe des entreprises sont stockées en clair dans la base Supabase (colonne `businesses.stripe_secret_key`), protégées uniquement par le Row Level Security. C'est correct pour un usage personnel ou entre gens de confiance, mais avant une vraie ouverture commerciale, il vaudrait mieux chiffrer ces clés (ou repasser sur Stripe Connect, plus robuste mais plus complexe à mettre en place). Dis-le-moi quand tu en es là.

## Configurer TON webhook Stripe (paiement automatique sur ton propre compte)

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
