# Brainrot Shop

## 🌐 Version en ligne (GitHub Pages)

Le site est déployé automatiquement sur GitHub Pages à chaque push sur cette branche (workflow `.github/workflows/deploy-pages.yml`, dossier `site/`) :

- **Boutique** : https://samir-zr.github.io/Claude/
- **Admin** : https://samir-zr.github.io/Claude/admin/

Cette version en ligne est 100% statique : pas de serveur à nous. Les données (catalogue, commandes, messages, apparence) vivent dans un bin JSON hébergé sur extendsclass.com, partagé entre la boutique et l'admin — c'est ce qui les relie. Conséquences honnêtes de ce choix :

- **Sécurité légère** : le mot de passe admin ne protège que l'interface. Quelqu'un de technique qui lit le code source de la page peut trouver l'adresse du bin et modifier les données directement. OK pour une boutique entre amis, pas pour du commerce sérieux.
- **Pérennité** : un bin inactif pendant plusieurs mois peut être supprimé par le service. Une boutique visitée régulièrement reste vivante.
- **Notifications** : l'admin vérifie les nouveautés toutes les 15 secondes quand l'onglet est ouvert (pas de push mobile).

La version serveur Node (ci-dessous) reste le chemin « sérieux » si un jour tu veux déployer sur Render avec une vraie protection côté serveur.

## Version serveur Node (locale / Render)

Deux sites reliés par un même serveur :

- **Site client** (`/`) — la boutique publique : catalogue, panier, commande, message au vendeur.
- **Site admin** (`/admin`) — l'espace de gestion : produits, commandes (avec notification en direct), messages reçus, et personnalisation de l'interface du site client.

Pas de paiement en ligne intégré : l'acheteur laisse son contact (email, Discord...) et tu le recontactes pour finaliser.

## Comment ça marche

### Site client (`/`)
- Grille de brainrot avec emoji, rareté, prix et stock.
- **Panier** : ajoute plusieurs brainrot, ajuste les quantités, puis commande (nom + contact). La commande est envoyée au vendeur.
- **Contacter le vendeur** : formulaire pour poser une question (optionnellement liée à un brainrot précis). Le vendeur répond directement via le contact que tu as donné — il n'y a pas de chat intégré.
- L'apparence (nom, logo, couleurs, bannière, et tout code personnalisé) vient du site admin.

### Site admin (`/admin`)
Protégé par mot de passe. Une fois connecté :
- **Produits** : ajouter / modifier / supprimer des brainrot (nom, emoji, rareté, prix, stock, description).
- **Commandes** : liste des commandes avec le détail des articles, le contact de l'acheteur, et un statut à mettre à jour (en attente / payée / livrée / annulée). Une **notification en direct** (son de cloche 🔔, toast, titre d'onglet qui clignote) arrive dès qu'une commande est passée, **si la page admin est ouverte** — sinon la commande t'attend simplement dans la liste à ta prochaine connexion (pas de notification push sur mobile ni d'email).
- **Messages** : boîte de réception des questions envoyées par les visiteurs, avec notification en direct comme pour les commandes.
- **Apparence** : bouton « Modifier » avec deux modes :
  - **Sans code** : nom, slogan, logo (emoji), couleurs, bannière, textes du catalogue — formulaire guidé, sûr.
  - **Code** : CSS, JavaScript et HTML personnalisés injectés tels quels sur le site client.

Les données (catalogue, commandes, messages, apparence) sont stockées côté serveur (`data/*.json`), donc **tout le monde voit la même chose** — ce n'est pas juste local à ton navigateur.

## ⚠️ Sécurité de l'éditeur de code

Le mode « Modifier le code » exécute le CSS/JS/HTML que tu colles **directement sur le site vu par tes clients**. C'est volontaire (tu contrôles totalement l'interface), mais ça veut dire que **si ton mot de passe admin fuite, n'importe qui peut injecter du code sur ta boutique publique** (défiguration, phishing...). Garde ce mot de passe secret, encore plus que pour la gestion des produits.

## Mot de passe admin

Par défaut : `brainrot123`. **Change-le avant de déployer** en définissant la variable d'environnement `ADMIN_PASSWORD`.

## Lancer en local

```bash
npm install
npm start
```

- Boutique : **http://localhost:3000**
- Admin : **http://localhost:3000/admin**

### Ouvrir les deux sites automatiquement

Pour lancer le serveur et ouvrir directement la boutique et l'admin dans deux onglets de ton navigateur par défaut :

```bash
npm install
npm run open
```

Ça démarre `node server.js` puis ouvre `http://localhost:3000/` et `http://localhost:3000/admin` dès que le serveur répond. Laisse le terminal ouvert (le serveur tourne tant que tu ne fais pas Ctrl+C) — les deux onglets restent utilisables en même temps, y compris les notifications en direct côté admin.

Pour changer le mot de passe en local :

```bash
ADMIN_PASSWORD=monmotdepasse npm start
```

## Déployer (Render, gratuit)

Ce site a un petit serveur Node (Express + WebSocket) — **GitHub Pages ne suffit pas** (fichiers statiques uniquement, pas de backend, pas de notifications en direct).

1. Pousse ce repo sur GitHub (déjà fait).
2. Va sur https://render.com → New → Blueprint → connecte ce repo.
3. Render lit `render.yaml` et déploie automatiquement.
4. Dans les settings du service, définis la variable d'environnement `ADMIN_PASSWORD` avec ton propre mot de passe.
5. Tu obtiens une URL du type `https://brainrot-shop-xxxx.onrender.com` (boutique) et `.../admin` (admin) à partager.

⚠️ Le plan gratuit de Render met le serveur en veille après un moment d'inactivité ; le premier visiteur après une pause attend ~30s le réveil du serveur, et la connexion WebSocket de l'admin se reconnecte automatiquement.

## Limites connues

- Pas de paiement en ligne intégré (Stripe, PayPal...) : les commandes sont juste enregistrées, à toi de contacter l'acheteur pour te faire payer.
- Pas de vraies notifications push (mobile/navigateur) ni d'email : les notifications de commande/message ne s'affichent que si la page admin est ouverte dans un onglet.
- Pas de chat en direct avec les clients : les messages sont à sens unique (client → admin), tu réponds via leur contact (email, Discord...), pas depuis le site.
- Le mot de passe admin est simple (pas de comptes multiples, pas de vrai système d'authentification) — suffisant pour une boutique perso, pas pour un usage professionnel sensible. Il protège aussi l'éditeur de code, donc à garder d'autant plus secret.
- Le plan gratuit Render n'a pas de disque persistant garanti sur le long terme selon le plan choisi ; pour une boutique durable, pense à passer sur un plan avec disque persistant ou une vraie base de données si le catalogue devient important.

## Structure du code

```
.
├── server.js               # Serveur Express + WebSocket (API + fichiers statiques)
├── data/
│   ├── brainrots.json      # Catalogue
│   ├── orders.json         # Commandes reçues
│   ├── messages.json       # Messages des visiteurs
│   └── settings.json       # Apparence du site client
├── public/
│   ├── client/              # Site public (boutique)
│   │   ├── index.html
│   │   ├── css/style.css
│   │   └── js/app.js
│   └── admin/                # Site admin (protégé par mot de passe)
│       ├── index.html
│       ├── css/style.css
│       └── js/app.js
├── package.json
└── render.yaml              # Config déploiement Render
```
