import { Link } from 'react-router-dom'
import { APP_NAME } from '../lib/theme'

// Les trois pages légales partagent le même gabarit d'affichage.
// Contenu à synchroniser avec les documents envoyés en relecture juridique.

function LegalLayout({ title, children }) {
  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: 48 }}>
      <div className="auth-card wide" style={{ maxWidth: 760 }}>
        <div className="brand-mark">{APP_NAME}</div>
        <h1>{title}</h1>
        <div className="legal-content">{children}</div>
        <Link to="/" className="link-btn">Retour à l'accueil</Link>
      </div>
    </div>
  )
}

export function MentionsLegales() {
  return (
    <LegalLayout title="Mentions légales">
      <p className="muted">Dernière mise à jour : 23 août 2026</p>

      <h2 className="section-title">Éditeur du site</h2>
      <p>
        Le site et l'application {APP_NAME} sont édités par :<br />
        <strong>CleanNet Multi-Service 06</strong><br />
        Entreprise individuelle (micro-entrepreneur)<br />
        Boulevard Pierre Delmas, 06600 Antibes, France<br />
        SIRET : 539 560 607 00035<br />
        TVA : non applicable, art. 293 B du CGI
      </p>
      <p>
        Responsable de la publication : Michael Martinez<br />
        Email de contact : cleannet06600@gmail.com
      </p>

      <h2 className="section-title">Hébergement</h2>
      <p>
        Application : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis<br />
        Base de données : Supabase Inc., 970 Toa Payoh North #07-04, Singapour
      </p>

      <h2 className="section-title">Propriété intellectuelle</h2>
      <p>
        L'ensemble des contenus présents sur ce site (textes, graphismes, logo, icônes, structure) est la propriété
        exclusive de CleanNet Multi-Service 06, sauf mention contraire. Toute reproduction sans autorisation
        préalable est interdite.
      </p>

      <h2 className="section-title">Limitation de responsabilité</h2>
      <p>
        L'éditeur s'efforce d'assurer l'exactitude des informations diffusées, sans garantir l'exhaustivité ou
        l'absence d'erreurs, et ne saurait être tenu responsable des dommages résultant de l'utilisation du site.
      </p>

      <h2 className="section-title">Droit applicable</h2>
      <p>Les présentes mentions légales sont soumises au droit français.</p>
    </LegalLayout>
  )
}

export function Confidentialite() {
  return (
    <LegalLayout title="Politique de confidentialité">
      <p className="muted">Dernière mise à jour : 23 août 2026</p>

      <p>
        {APP_NAME} (édité par CleanNet Multi-Service 06) attache une grande importance à la protection de vos
        données personnelles. Cette page explique quelles données nous collectons, pourquoi, et comment vous
        pouvez exercer vos droits.
      </p>

      <h2 className="section-title">1. Responsable du traitement</h2>
      <p>
        CleanNet Multi-Service 06 — Boulevard Pierre Delmas, 06600 Antibes — SIRET 539 560 607 00035<br />
        Contact : cleannet06600@gmail.com
      </p>

      <h2 className="section-title">2. Données collectées</h2>
      <p>
        Informations de compte (email, mot de passe chiffré, nom d'entreprise, SIRET, adresse, régime de TVA),
        données de facturation gérées par Stripe (nous ne stockons jamais vos numéros de carte), et les données
        de vos propres clients que vous saisissez pour générer vos devis et factures.
      </p>

      <h2 className="section-title">3. Pourquoi nous les traitons</h2>
      <p>
        Pour fournir le service, facturer votre abonnement, vous envoyer les emails liés au service, répondre à
        vos demandes de support, et respecter nos obligations légales et comptables.
      </p>

      <h2 className="section-title">4. Qui a accès à vos données</h2>
      <p>
        Nous ne vendons jamais vos données. Elles sont partagées uniquement avec les prestataires nécessaires :
        Supabase (base de données), Vercel (hébergement), Stripe (paiements, certifié PCI-DSS), Brevo (emails).
      </p>

      <h2 className="section-title">5. Durée de conservation</h2>
      <p>
        Données de compte : pendant la durée de l'abonnement, puis 12 mois après résiliation. Documents
        comptables (devis, factures) : 10 ans, conformément aux obligations légales françaises.
      </p>

      <h2 className="section-title">6. Vos droits</h2>
      <p>
        Accès, rectification, effacement, limitation, portabilité et opposition — conformément au RGPD. Pour les
        exercer : cleannet06600@gmail.com. Vous pouvez aussi saisir la CNIL (www.cnil.fr).
      </p>

      <h2 className="section-title">7. Sécurité</h2>
      <p>
        Mots de passe chiffrés, connexions HTTPS, isolation des données entre entreprises utilisatrices,
        accès restreint aux données sensibles.
      </p>

      <h2 className="section-title">8. Cookies</h2>
      <p>
        Uniquement des cookies strictement nécessaires au fonctionnement du service (session de connexion).
        Aucun cookie publicitaire ou de tracking tiers.
      </p>
    </LegalLayout>
  )
}

export function CGV() {
  return (
    <LegalLayout title="Conditions Générales de Vente et d'Utilisation">
      <p className="muted">Dernière mise à jour : 23 août 2026</p>

      <h2 className="section-title">Article 1 — Objet</h2>
      <p>
        Les présentes CGVU régissent l'accès et l'utilisation du service {APP_NAME}, une application en ligne
        (SaaS) de création de devis, factures et gestion de paiements en ligne, éditée par CleanNet
        Multi-Service 06 ("l'Éditeur"), souscrite par toute personne physique ou morale ("l'Utilisateur").
        L'utilisation du service implique l'acceptation pleine et entière des présentes CGVU.
      </p>

      <h2 className="section-title">Article 2 — Description du service</h2>
      <p>
        Création de devis et factures conformes à la réglementation française, envoi de documents par email,
        génération de liens de paiement en ligne via Stripe, suivi de trésorerie, catalogue de prestations,
        export comptable, et toute autre fonctionnalité décrite sur le site au moment de la souscription.
      </p>

      <h2 className="section-title">Article 3 — Inscription et compte</h2>
      <p>
        L'accès nécessite un compte avec une adresse email valide et des informations exactes. L'Utilisateur est
        seul responsable de la confidentialité de ses identifiants.
      </p>

      <h2 className="section-title">Article 4 — Essai gratuit</h2>
      <p>
        Chaque nouveau compte bénéficie de 7 jours d'essai gratuit, sans moyen de paiement requis. À l'issue,
        l'accès est suspendu jusqu'à souscription d'un abonnement payant.
      </p>

      <h2 className="section-title">Article 5 — Tarifs et paiement</h2>
      <p>
        Abonnement facturé 15 € TTC par mois, prélevé automatiquement via Stripe. Tout changement de tarif est
        notifié au moins 30 jours avant son entrée en vigueur.
      </p>

      <h2 className="section-title">Article 6 — Durée et résiliation</h2>
      <p>
        Sans engagement, renouvellement automatique mensuel. Résiliable à tout moment depuis l'espace client ou
        via cleannet06600@gmail.com ; prend effet à la fin de la période en cours, sans remboursement au prorata.
      </p>

      <h2 className="section-title">Article 7 — Obligations de l'Utilisateur</h2>
      <p>
        Utiliser le service conformément à la loi, garantir l'exactitude des informations saisies, et rester
        seul responsable de la conformité fiscale et légale des documents générés (l'Éditeur fournit un outil,
        pas un conseil fiscal ou juridique).
      </p>

      <h2 className="section-title">Article 8 — Données et paiements de tiers</h2>
      <p>
        L'Utilisateur peut connecter son propre compte Stripe pour encaisser directement ses clients. L'Éditeur
        n'est jamais dépositaire des fonds ; ces flux sont gérés par Stripe.
      </p>

      <h2 className="section-title">Article 9 — Propriété intellectuelle</h2>
      <p>
        Le logiciel, son code, son design et sa marque restent la propriété exclusive de l'Éditeur. L'abonnement
        confère un droit d'usage personnel, non exclusif et non transférable. Les données saisies par
        l'Utilisateur restent sa propriété et sont exportables à tout moment (CSV).
      </p>

      <h2 className="section-title">Article 10 — Disponibilité et responsabilité</h2>
      <p>
        L'Éditeur s'efforce d'assurer un accès continu, sans garantie absolue. Sa responsabilité, si retenue,
        est limitée au montant versé par l'Utilisateur au titre des 12 derniers mois d'abonnement.
      </p>

      <h2 className="section-title">Article 11 — Droit de rétractation</h2>
      <p>
        <strong>Clients professionnels (B2B)</strong> : le droit de rétractation ne s'applique pas entre
        professionnels.
      </p>
      <p>
        <strong>Clients consommateurs (B2C)</strong> : conformément à l'article L.221-18 du Code de la
        consommation, l'Utilisateur consommateur dispose de 14 jours à compter de la souscription pour se
        rétracter, sans justification, en écrivant à cleannet06600@gmail.com. Conformément à l'article L.221-28,
        ce droit ne s'applique plus si l'Utilisateur a expressément demandé l'exécution immédiate du service et
        renoncé à son droit de rétractation lors de son inscription.
      </p>

      <h2 className="section-title">Article 12 — Droit applicable et litiges</h2>
      <p>
        Droit français. Tout consommateur peut recourir gratuitement à un médiateur de la consommation. À
        défaut d'accord amiable, les tribunaux français compétents seront seuls saisis.
      </p>

      <h2 className="section-title">Article 13 — Contact</h2>
      <p>cleannet06600@gmail.com</p>
    </LegalLayout>
  )
}
