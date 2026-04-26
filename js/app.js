// ============================================================
// SCOLANET — Espace Numérique de Travail (type Pronote)
// ============================================================

// ---------- COMPTES ÉLÈVES ----------
// Modifiez ces identifiants selon vos besoins.
// En mode démo, n'importe quel identifiant fonctionne.
const ACCOUNTS = [
  {
    username: "lea.martin",
    password: "lycee2026",
    nom: "Léa Martin",
    classe: "Terminale S — 1ère S2",
    initiales: "LM",
  },
  // Ajoutez d'autres comptes ici si besoin
];

const DEMO_MODE = true; // mettez à false pour exiger des identifiants valides

// ---------- DONNÉES MOCK ----------
const TODAY = [
  { time: "08:00 - 09:00", subj: "Mathématiques", teacher: "M. Dubois", room: "Salle 204" },
  { time: "09:00 - 10:00", subj: "Histoire-Géo", teacher: "Mme Laurent", room: "Salle 112" },
  { time: "10:15 - 12:15", subj: "Physique-Chimie", teacher: "M. Bernard", room: "Labo P1" },
  { time: "13:30 - 15:30", subj: "Français", teacher: "Mme Rousseau", room: "Salle 308" },
  { time: "15:45 - 16:45", subj: "EPS", teacher: "M. Garnier", room: "Gymnase" },
];

const RECENT_GRADES = [
  { subj: "Mathématiques", title: "DS Suites", grade: "16/20" },
  { subj: "Histoire-Géo", title: "Composition", grade: "14/20" },
  { subj: "SVT", title: "Interro génétique", grade: "17/20" },
  { subj: "Anglais", title: "Oral", grade: "15/20" },
];

const TIMETABLE_DATA = {
  hours: ["08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h"],
  days: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"],
  cells: {
    // [day][hour] => { subj, room, color }
    "Lundi": {
      "08h": { subj: "Maths", room: "S.204", color: "" },
      "09h": { subj: "Histoire", room: "S.112", color: "purple" },
      "10h": { subj: "Physique", room: "Labo P1", color: "green" },
      "11h": { subj: "Physique", room: "Labo P1", color: "green" },
      "13h": { subj: "Français", room: "S.308", color: "orange" },
      "14h": { subj: "Français", room: "S.308", color: "orange" },
      "15h": { subj: "EPS", room: "Gymnase", color: "pink" },
    },
    "Mardi": {
      "08h": { subj: "Anglais", room: "S.115", color: "purple" },
      "09h": { subj: "Maths", room: "S.204", color: "" },
      "10h": { subj: "SVT", room: "Labo B2", color: "green" },
      "11h": { subj: "SVT", room: "Labo B2", color: "green" },
      "13h": { subj: "Philo", room: "S.301", color: "orange" },
      "14h": { subj: "Philo", room: "S.301", color: "orange" },
      "15h": { subj: "Espagnol", room: "S.117", color: "pink" },
    },
    "Mercredi": {
      "08h": { subj: "Maths", room: "S.204", color: "" },
      "09h": { subj: "Maths", room: "S.204", color: "" },
      "10h": { subj: "Histoire", room: "S.112", color: "purple" },
      "11h": { subj: "Anglais", room: "S.115", color: "purple" },
    },
    "Jeudi": {
      "08h": { subj: "Physique", room: "Labo P1", color: "green" },
      "09h": { subj: "Physique", room: "Labo P1", color: "green" },
      "10h": { subj: "Français", room: "S.308", color: "orange" },
      "11h": { subj: "Français", room: "S.308", color: "orange" },
      "13h": { subj: "Maths", room: "S.204", color: "" },
      "14h": { subj: "SVT", room: "Labo B2", color: "green" },
      "15h": { subj: "Philo", room: "S.301", color: "orange" },
    },
    "Vendredi": {
      "08h": { subj: "Espagnol", room: "S.117", color: "pink" },
      "09h": { subj: "Histoire", room: "S.112", color: "purple" },
      "10h": { subj: "Anglais", room: "S.115", color: "purple" },
      "11h": { subj: "EPS", room: "Gymnase", color: "pink" },
      "13h": { subj: "Maths", room: "S.204", color: "" },
      "14h": { subj: "Maths", room: "S.204", color: "" },
      "15h": { subj: "Vie de classe", room: "S.205", color: "orange" },
    },
  },
};

const GRADES_BY_SUBJECT = [
  { subj: "Mathématiques", avg: 16.2, classAvg: 12.8, grades: [{n:"16",c:"high"},{n:"15",c:"high"},{n:"18",c:"high"},{n:"15.5",c:"high"}] },
  { subj: "Physique-Chimie", avg: 14.5, classAvg: 11.4, grades: [{n:"14",c:"med"},{n:"15",c:"high"},{n:"14.5",c:"med"}] },
  { subj: "SVT", avg: 17.0, classAvg: 13.2, grades: [{n:"17",c:"high"},{n:"17",c:"high"},{n:"17",c:"high"}] },
  { subj: "Français", avg: 13.8, classAvg: 12.1, grades: [{n:"14",c:"med"},{n:"13",c:"med"},{n:"14.5",c:"med"}] },
  { subj: "Histoire-Géographie", avg: 14.0, classAvg: 12.5, grades: [{n:"14",c:"med"},{n:"13",c:"med"},{n:"15",c:"high"}] },
  { subj: "Anglais LV1", avg: 15.5, classAvg: 13.0, grades: [{n:"15",c:"high"},{n:"16",c:"high"},{n:"15.5",c:"high"}] },
  { subj: "Espagnol LV2", avg: 15.0, classAvg: 12.4, grades: [{n:"15",c:"high"},{n:"15",c:"high"}] },
  { subj: "Philosophie", avg: 13.5, classAvg: 11.0, grades: [{n:"13",c:"med"},{n:"14",c:"med"}] },
  { subj: "EPS", avg: 17.0, classAvg: 14.5, grades: [{n:"17",c:"high"},{n:"17",c:"high"}] },
];

const HOMEWORK = [
  { id: 1, subj: "Mathématiques", title: "Exercices 12 à 18 p.142", desc: "Sur les intégrales — à rendre en début de cours", due: "Demain", done: false, late: false },
  { id: 2, subj: "Français", title: "Dissertation à rendre", desc: "Sujet : « Le héros romantique est-il un héros tragique ? » 4 pages", due: "Vendredi 1er mai", done: false, late: false },
  { id: 3, subj: "Anglais", title: "Lire le chapitre 5 de 1984", desc: "Préparer un résumé de 10 lignes", due: "Lundi 4 mai", done: false, late: false },
  { id: 4, subj: "Histoire-Géo", title: "Fiche de révision Guerre froide", desc: "Pour préparer le contrôle du 7 mai", due: "Mercredi 6 mai", done: true, late: false },
  { id: 5, subj: "SVT", title: "Compte-rendu de TP génétique", desc: "Format numérique sur l'ENT", due: "Hier", done: false, late: true },
  { id: 6, subj: "Physique-Chimie", title: "Exercices ondes mécaniques", desc: "Ex 5, 7, 9 p.218", due: "Jeudi 30 avril", done: false, late: false },
];

const MESSAGES = [
  {
    id: 1, from: "M. Dubois (Mathématiques)", subject: "Note du DS de mardi",
    time: "Aujourd'hui 09:42", unread: true,
    body: "Bonjour Léa,\n\nJe tiens à te féliciter pour ton excellent travail sur le devoir surveillé de mardi. Tu obtiens 16/20, ce qui est un très bon résultat compte tenu de la difficulté du sujet.\n\nContinue ainsi pour le bac blanc.\n\nCordialement,\nM. Dubois"
  },
  {
    id: 2, from: "Vie scolaire", subject: "Rappel : autorisation de sortie",
    time: "Hier 16:20", unread: true,
    body: "Bonjour,\n\nNous vous rappelons que l'autorisation de sortie pour la visite du musée d'Orsay du 12 mai doit être signée et remise au CPE avant le 5 mai.\n\nMerci de votre diligence.\n\nLa Vie Scolaire"
  },
  {
    id: 3, from: "Mme Laurent (Histoire-Géo)", subject: "Plan du chapitre",
    time: "24 avril", unread: true,
    body: "Bonjour à tous,\n\nVeuillez trouver ci-joint le plan détaillé du chapitre sur la décolonisation. Apprenez-le pour le prochain cours, j'interrogerai à l'oral.\n\nBonne soirée.\nMme Laurent"
  },
  {
    id: 4, from: "Direction", subject: "Réunion parents-professeurs",
    time: "20 avril", unread: false,
    body: "Chers parents, chers élèves,\n\nLa réunion parents-professeurs du 2ème trimestre se tiendra le jeudi 14 mai de 17h à 20h. Les rendez-vous individuels peuvent être pris via l'ENT.\n\nCordialement,\nLa Direction"
  },
  {
    id: 5, from: "CDI", subject: "Retour des manuels",
    time: "15 avril", unread: false,
    body: "Bonjour,\n\nMerci de penser à rendre les ouvrages empruntés au CDI avant la fin du mois.\n\nL'équipe du CDI"
  },
];

// ---------- ÉTAT ----------
let currentUser = null;
let currentMessageId = null;

// ---------- UTILITAIRES ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---------- LOGIN ----------
$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const u = $("#username").value.trim();
  const p = $("#password").value;

  let user = ACCOUNTS.find(a => a.username === u && a.password === p);

  if (!user && DEMO_MODE) {
    // En mode démo : on crée un compte fictif depuis l'identifiant saisi
    const name = u.split(/[._]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ") || "Élève Démo";
    const initials = name.split(" ").map(p => p[0]).join("").slice(0,2).toUpperCase();
    user = { username: u, nom: name, classe: "Terminale S — 1ère S2", initiales: initials };
  }

  if (!user) {
    alert("Identifiant ou mot de passe incorrect.");
    return;
  }

  currentUser = user;
  $("#user-name").textContent = user.nom;
  $("#user-class").textContent = user.classe;
  $("#user-avatar").textContent = user.initiales;

  $("#login-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  renderAll();
});

$("#logout").addEventListener("click", () => {
  currentUser = null;
  $("#app").classList.add("hidden");
  $("#login-screen").classList.remove("hidden");
  $("#login-form").reset();
});

// ---------- NAVIGATION ----------
const VIEW_TITLES = {
  dashboard: ["Tableau de bord", "Bienvenue, voici un aperçu de votre journée"],
  timetable: ["Emploi du temps", "Vos cours de la semaine"],
  grades: ["Notes et bulletin", "Détail de vos résultats par matière"],
  homework: ["Cahier de textes", "Travail à faire et à venir"],
  absences: ["Vie scolaire", "Absences, retards et sanctions"],
  messages: ["Messagerie", "Vos communications avec l'établissement"],
};

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-view]");
  if (!link) return;
  e.preventDefault();
  const view = link.dataset.view;
  switchView(view);
});

function switchView(view) {
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === view));
  $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
  const [t, s] = VIEW_TITLES[view] || ["", ""];
  $("#view-title").textContent = t;
  $("#view-subtitle").textContent = s;
}

// ---------- RENDU ----------
function renderAll() {
  renderToday();
  renderRecentGrades();
  renderHomeworkMini();
  renderTimetable();
  renderGradesTable();
  renderHomework();
  renderMessages();

  const today = new Date();
  const opts = { weekday: 'long', day: 'numeric', month: 'long' };
  $("#today-date").textContent = today.toLocaleDateString('fr-FR', opts);
}

function renderToday() {
  $("#today-list").innerHTML = TODAY.map(c => `
    <li>
      <span class="time">${c.time}</span>
      <span class="subj"><strong>${c.subj}</strong><br><span class="muted">${c.teacher}</span></span>
      <span class="room">${c.room}</span>
    </li>
  `).join("");
}

function renderRecentGrades() {
  $("#recent-grades").innerHTML = RECENT_GRADES.map(g => `
    <li>
      <span><strong>${g.subj}</strong><br><span class="muted">${g.title}</span></span>
      <span class="grade-pill">${g.grade}</span>
    </li>
  `).join("");
}

function renderHomeworkMini() {
  const upcoming = HOMEWORK.filter(h => !h.done).slice(0, 4);
  $("#hw-mini").innerHTML = upcoming.map(h => `
    <li>
      <h4>${h.subj}</h4>
      <small>${h.title}</small>
      <small class="hw-due ${h.late ? 'late' : ''}">Pour ${h.due}</small>
    </li>
  `).join("");
}

function renderTimetable() {
  const { hours, days, cells } = TIMETABLE_DATA;
  let html = `<div class="tt-empty"></div>`;
  days.forEach(d => html += `<div class="tt-head">${d}</div>`);

  hours.forEach(h => {
    html += `<div class="tt-time">${h}</div>`;
    days.forEach(d => {
      const cell = cells[d] && cells[d][h];
      if (cell) {
        html += `<div class="tt-cell ${cell.color}"><strong>${cell.subj}</strong><span>${cell.room}</span></div>`;
      } else {
        html += `<div class="tt-empty"></div>`;
      }
    });
  });

  $("#timetable").innerHTML = html;
}

function renderGradesTable() {
  $("#grades-table").innerHTML = GRADES_BY_SUBJECT.map(g => `
    <tr>
      <td class="subj-name">${g.subj}</td>
      <td><strong>${g.avg.toFixed(1)}</strong> / 20</td>
      <td class="muted">${g.classAvg.toFixed(1)} / 20</td>
      <td>${g.grades.map(n => `<span class="grade-chip ${n.c}">${n.n}</span>`).join("")}</td>
    </tr>
  `).join("");
}

function renderHomework() {
  $("#homework-list").innerHTML = HOMEWORK.map(h => `
    <li data-id="${h.id}">
      <div class="hw-check ${h.done ? 'done' : ''}" onclick="toggleHomework(${h.id})"></div>
      <div class="hw-body">
        <h4>${h.subj} — ${h.title}</h4>
        <p>${h.desc}</p>
        <div class="hw-meta">
          <span class="hw-due ${h.late ? 'late' : ''}">📅 Pour ${h.due}</span>
          ${h.done ? '<span class="tag tag--ok">Terminé</span>' : ''}
          ${h.late ? '<span class="tag tag--danger">En retard</span>' : ''}
        </div>
      </div>
    </li>
  `).join("");
}

function toggleHomework(id) {
  const hw = HOMEWORK.find(h => h.id === id);
  if (hw) {
    hw.done = !hw.done;
    if (hw.done) hw.late = false;
    renderHomework();
    renderHomeworkMini();
  }
}

function renderMessages() {
  $("#msg-list").innerHTML = MESSAGES.map(m => `
    <div class="msg-item ${m.unread ? 'unread' : ''}" data-id="${m.id}" onclick="openMessage(${m.id})">
      <span class="time">${m.time}</span>
      <strong>${m.from}</strong>
      <p>${m.subject}</p>
    </div>
  `).join("");

  const unreadCount = MESSAGES.filter(m => m.unread).length;
  $("#msg-badge").textContent = unreadCount;
  $("#msg-badge").style.display = unreadCount > 0 ? '' : 'none';
}

function openMessage(id) {
  const msg = MESSAGES.find(m => m.id === id);
  if (!msg) return;

  msg.unread = false;
  currentMessageId = id;

  $$(".msg-item").forEach(el => el.classList.toggle("active", parseInt(el.dataset.id) === id));

  $("#msg-pane").innerHTML = `
    <div class="msg-header">
      <h3>${msg.subject}</h3>
      <p>De : <strong>${msg.from}</strong> — ${msg.time}</p>
    </div>
    <div class="msg-body">${msg.body}</div>
  `;

  renderMessages();
}

// expose pour les onclick inline
window.toggleHomework = toggleHomework;
window.openMessage = openMessage;
