# Steal a Brainrot — Clone Web Multijoueur

Un clone web du jeu Roblox **Steal a Brainrot**, jouable dans le navigateur, multijoueur en temps réel grâce à un petit serveur Node.js + WebSocket.

## Comment ça marche

- **Tu arrives sur la map**, on t'attribue automatiquement une parcelle (plot) avec 8 stands vides.
- Un **tapis roulant** fait défiler des **brainrots** (Tralalero, Bombardiro, Tung Tung Tung Sahur, etc.) avec leur prix et leur revenu.
- Approche-toi d'un brainrot sur ton tapis, **appuie sur E** → il atterrit sur ton prochain stand libre et te rapporte du cash chaque seconde.
- Va sur la base d'un autre joueur, **maintiens E** pendant 4 secondes sur un de ses brainrots → tu lui voles !
- Le propriétaire peut **verrouiller sa base avec L** (cooldown 10s) ou **repousser les intrus avec F**.

## Commandes

| Touche       | Action                          |
|--------------|----------------------------------|
| Z/Q/S/D ou WASD | Se déplacer                  |
| Souris       | Regarder                         |
| Espace       | Sauter                           |
| Maj          | Courir                           |
| **E**        | Acheter / Voler (maintien) / Vendre |
| **L**        | Verrouiller / déverrouiller la base |
| **F**        | Repousser les intrus à proximité |
| Échap        | Libérer la souris                |

## Lancer en local

```bash
npm install
npm start
```

Puis ouvre **http://localhost:3000** dans plusieurs onglets ou sur plusieurs ordis du même réseau.

Le serveur accepte jusqu'à **4 joueurs** en simultané (une parcelle par joueur).

## Déployer sur Internet (gratuit, ~5 min)

Le serveur est livré avec une config **Render.com** prête à l'emploi.

### Avec Render

1. Pousse ce repo sur GitHub (déjà fait).
2. Va sur https://render.com → crée un compte gratuit.
3. Clique **New → Blueprint**, connecte ton repo GitHub, sélectionne le repo.
4. Render lit `render.yaml` et déploie automatiquement.
5. Tu obtiens une URL `https://steal-a-brainrot-xxxx.onrender.com` à partager.

### Avec Railway (alternative)

1. https://railway.app → New Project → Deploy from GitHub.
2. Variables : aucune (Railway lit `package.json`).
3. Settings → Generate Domain → tu obtiens l'URL.

### Avec Fly.io / Heroku / Glitch

Même principe : `npm install` + `npm start`, port lu depuis `process.env.PORT`.

> ⚠️ **GitHub Pages ne suffit pas** : il ne sert que des fichiers statiques, pas de serveur Node. Le client a besoin du serveur WebSocket pour le multijoueur.

## Structure du code

```
.
├── index.html              # Page principale (menu + HUD)
├── css/style.css           # Styles
├── js/
│   ├── app.js              # Boucle principale + UI
│   ├── world.js            # Scène Three.js (terrain, plots, brainrots)
│   ├── player.js           # Contrôleur FPS (pointer lock)
│   └── network.js          # Client WebSocket
├── shared/
│   └── brainrots.js        # Catalogue brainrots (partagé client/serveur)
├── server/
│   └── server.js           # Serveur Node + WebSocket (autorité du jeu)
├── package.json
└── render.yaml             # Config déploiement Render
```

## Brainrots disponibles

14 personnages répartis en 6 raretés :
- **Commun** : Trippi Troppi, Frigo Camelo, Boneca Ambalabu, Bombombini Gusini
- **Rare** : Brr Brr Patapim, Chimpanzini Bananini, Lirilì Larilà
- **Épique** : Cappuccino Assassino, Tung Tung Tung Sahur
- **Légendaire** : Bombardiro Crocodilo, Tralalero Tralala
- **Mythique** : Bobrito Bandito, Trulimero Trulicina
- **Brainrot God** : La Vacca Saturno Saturnita

## Limites connues

- 4 joueurs max (un par plot — facile à étendre dans `server/server.js`).
- Pas de combat / armes (juste le knock-back avec F).
- Pas de sauvegarde : si le serveur redémarre, tout est perdu.
- Pas de leaderboard / rebirths.

Bon jeu !
