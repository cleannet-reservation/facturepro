# FacturePro

Devis, factures et acomptes en ligne — SaaS multi-clients avec abonnement.

## Fonctionnalités

- Devis et factures (complète, acompte, solde) avec calcul auto HT/TVA/TTC
- PDF avec logo entreprise et mentions légales adaptées (franchise en base / TVA / crédit d'impôt SAP)
- Envoi du devis par email au client (Brevo) avec page de consultation publique et acceptation en ligne
- Envoi de facture par email avec PDF en pièce jointe
- Statut "en retard" automatique + relances par email (manuelles ou automatiques une fois par jour)
- Paiement d'acompte ou paiement complet via lien Stripe, confirmé automatiquement par webhook
- Duplication de devis/factures existants
- Recherche et filtres sur les listes, export CSV comptable
- Catalogue de prestations réutilisables, fiche client enrichie
- Attestation fiscale annuelle pour les clients éligibles au crédit d'impôt SAP
- Trésorerie prévisionnelle (argent à venir par échéance)
- Marque blanche : nom d'app et couleur personnalisables par déploiement
- Abonnement mensuel des clients à la plateforme (Stripe Subscriptions) avec essai gratuit de 14 jours
- Panneau super admin : liste des abonnés, activation/désactivation manuelle, connexion en tant que client (support)
- Factures d'achat, notes de frais, factures récurrentes
- Tableau de bord avec graphique de chiffre d'affaires et statuts cliquables

## Installation complète (projet neuf)

### 1. Créer le projet Supabase

1. [supabase.com](https://supabase.com) → **New Project** → nom, mot de passe, région Europe
2. **SQL Editor** → **New query** → colle tout le contenu de `supabase/schema.sql` → **Run**

### 2. Récupérer tes clés Supabase

**Project Settings → API** : Project URL, Publishable key (`sb_publishable_...`), Secret key (`sb_secret_...`)

### 3. Mettre le code sur GitHub

Crée un repo, uploade tout le contenu de ce dossier.

### 4. Importer dans Vercel

[vercel.com/new](https://vercel.com/new) → importe le repo → **avant de déployer**, ajoute toutes les variables d'environnement listées dans `.env.example` (voir sections ci-dessous pour savoir où trouver chaque valeur) → **Deploy**

### 5. Premier compte

Crée ton compte sur ton site → configure ton entreprise.

### 6. Webhook Stripe pour tes propres paiements clients

1. Stripe → **Webhooks → + Ajouter une destination**
2. Événement : `checkout.session.completed` — Périmètre : "Votre compte"
3. URL : `https://TON-SITE.vercel.app/api/stripe-webhook`
4. Copie le Signing secret → `STRIPE_WEBHOOK_SECRET` sur Vercel → redéploie

Ensuite, dans **Paramètres** de l'app, colle ta clé Stripe secrète (`sk_live_...`), teste-la, enregistre-la.

### 7. Abonnement plateforme (pour facturer tes futurs clients)

1. Stripe → **Product catalog → + Add product** → coche **Recurring** → prix mensuel (ex. 15€) → **Save**
2. Copie l'**ID du tarif** (`price_...`) → `STRIPE_PRICE_ID` sur Vercel
3. Nouveau webhook Stripe :
   - URL : `https://TON-SITE.vercel.app/api/platform-webhook`
   - Événements : `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
4. Copie son Signing secret → `STRIPE_PLATFORM_WEBHOOK_SECRET` sur Vercel
5. Redéploie

### 8. Te déclarer super admin

1. Supabase → **Authentication → Users** → clique ta ligne → copie le **User UID**
2. **SQL Editor** :
   ```sql
   insert into platform_admins (user_id) values ('COLLE-TON-USER-UID-ICI');
   ```
3. Reconnecte-toi — le lien **"Super admin"** apparaît dans ton menu

### 9. Brevo (envoi d'email)

1. Brevo → **Paramètres → Expéditeurs** → valide ton email de contact
2. **SMTP & API → API Keys** → copie la clé → `BREVO_API_KEY` sur Vercel

### 10. Vérifs finales sur Supabase

**Authentication → URL Configuration** → Site URL = ton URL Vercel, Redirect URLs contient `https://TON-SITE.vercel.app/reinitialiser-mot-de-passe`

## Variables d'environnement — résumé

| Variable | Où la trouver |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Secret keys |
| `VITE_APP_NAME` | Optionnel, marque blanche |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Étape 6 |
| `STRIPE_PRICE_ID` | Étape 7 |
| `STRIPE_PLATFORM_WEBHOOK_SECRET` | Étape 7 |
| `BREVO_API_KEY` | Brevo → SMTP & API |
| `CRON_SECRET` | Chaîne aléatoire de ton choix |

## Paiements par entreprise (clé Stripe directe)

Chaque entreprise abonnée colle sa **propre clé Stripe secrète** dans Paramètres → Paiements en ligne, testée avant enregistrement. Pour la confirmation automatique des paiements, elle crée un webhook sur SON compte Stripe pointant vers l'URL unique affichée dans ses Paramètres (`/api/stripe-webhook?business=...`), et colle le Signing secret obtenu.

**Note de sécurité avant ouverture commerciale large** : les clés Stripe sont stockées en clair en base (RLS uniquement). Envisager un chiffrement ou Stripe Connect avant une vraie mise à l'échelle.

## Relances automatiques des factures en retard

Chaque jour à 8h UTC (`vercel.json`), `/api/send-reminders` marque les factures en retard et envoie une relance email (max 1 fois/7 jours par facture).

## Panneau Super admin

`/admin` : liste des entreprises, statut d'abonnement, MRR estimé, bouton pour bloquer/débloquer l'accès, bouton "Se connecter" (génère un lien magique — à ouvrir en navigation privée pour ne pas remplacer ta propre session).

## Stack technique

React + Vite, Supabase (base de données + auth + RLS + storage), Stripe (paiements + abonnements), Brevo (email), jsPDF (génération PDF côté client).
