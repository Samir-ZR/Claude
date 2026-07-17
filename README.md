# Brainrot Shop

Boutique en ligne pour vendre les brainrot de ton jeu. Catalogue géré depuis un panneau admin (ajout, modification, suppression, prix, stock), visible par tous les visiteurs, avec un système de commande simple (pas de paiement en ligne — l'acheteur laisse son contact et tu le recontactes pour finaliser).

## Comment ça marche

- **Boutique publique** : grille de brainrot avec emoji, rareté, prix et stock. Un visiteur clique sur « Acheter », renseigne son nom + un moyen de contact (email, Discord...), et la commande t'est envoyée.
- **Mode admin** (bouton 🔒 en haut à droite) : entre le mot de passe admin pour débloquer :
  - **Ajouter / modifier / supprimer** des brainrot (nom, emoji, rareté, prix, stock, description).
  - **Onglet Commandes** : liste des commandes reçues, avec le contact de l'acheteur et un statut à mettre à jour (en attente / payée / livrée / annulée).
- Les données (catalogue + commandes) sont stockées côté serveur dans `data/brainrots.json` et `data/orders.json`, donc **tout le monde voit le même catalogue**, contrairement à une solution 100% front-end avec localStorage.

## Mot de passe admin

Par défaut : `brainrot123`. **Change-le avant de déployer** en définissant la variable d'environnement `ADMIN_PASSWORD`.

## Lancer en local

```bash
npm install
npm start
```

Puis ouvre **http://localhost:3000**.

Pour changer le mot de passe en local :

```bash
ADMIN_PASSWORD=monmotdepasse npm start
```

## Déployer (Render, gratuit)

Ce site a un petit serveur Node (Express) — **GitHub Pages ne suffit pas** (fichiers statiques uniquement, pas de backend).

1. Pousse ce repo sur GitHub (déjà fait).
2. Va sur https://render.com → New → Blueprint → connecte ce repo.
3. Render lit `render.yaml` et déploie automatiquement.
4. Dans les settings du service, définis la variable d'environnement `ADMIN_PASSWORD` avec ton propre mot de passe.
5. Tu obtiens une URL du type `https://brainrot-shop-xxxx.onrender.com` à partager.

⚠️ Le plan gratuit de Render met le serveur en veille après un moment d'inactivité ; le premier visiteur après une pause attend ~30s le réveil du serveur.

## Limites connues

- Pas de paiement en ligne intégré (Stripe, PayPal...) : les commandes sont juste enregistrées, à toi de contacter l'acheteur pour te faire payer. Si tu veux automatiser les paiements, il faudra brancher une vraie solution de paiement.
- Le mot de passe admin est simple (pas de comptes multiples, pas de vrai système d'authentification) — suffisant pour une boutique perso, pas pour un usage professionnel sensible.
- Le plan gratuit Render n'a pas de disque persistant garanti sur le long terme selon le plan choisi ; pour une boutique durable, pense à passer sur un plan avec disque persistant ou une vraie base de données si le catalogue devient important.

## Structure du code

```
.
├── server.js            # Serveur Express (API + fichiers statiques)
├── data/
│   ├── brainrots.json   # Catalogue (créé/modifié via l'admin)
│   └── orders.json      # Commandes reçues
├── public/
│   ├── index.html       # Boutique + panneau admin
│   ├── css/style.css
│   └── js/app.js
├── package.json
└── render.yaml           # Config déploiement Render
```
