// Steal a Brainrot — clone (work in progress)
// Architecture multijoueur en attente de confirmation utilisateur.
// Cette base ne contient que le menu pour l'instant.

const playBtn = document.getElementById('play');
const menu = document.getElementById('menu');

if (playBtn && menu) {
  playBtn.addEventListener('click', () => {
    alert('Le jeu est en cours de construction. L\'architecture multijoueur est en attente de validation.');
  });
}
