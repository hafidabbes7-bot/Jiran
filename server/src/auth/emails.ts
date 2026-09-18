/**
 * Les messages envoyés aux voisins pour confirmer une adresse ou reprendre la
 * main sur un compte.
 *
 * En texte simple, pas en HTML : c'est ce qui arrive le plus sûrement dans une
 * boîte, ce qui se lit sur n'importe quel téléphone, et ce qui a le moins de
 * chances d'être rangé dans les indésirables.
 */

export function messageDeConfirmation(lien: string): string {
  return [
    'Bienvenue sur Jiran !',
    '',
    'Pour terminer la création de ton compte, ouvre ce lien :',
    lien,
    '',
    'Le lien reste valable 24 heures.',
    '',
    "Si tu n'as pas demandé de compte Jiran, ignore ce message : sans cette",
    "confirmation, rien n'est créé.",
  ].join('\n');
}

export function messageDeReinitialisation(lien: string): string {
  return [
    'Tu as demandé à changer ton mot de passe Jiran.',
    '',
    'Ouvre ce lien pour en choisir un nouveau :',
    lien,
    '',
    "Le lien reste valable 1 heure, et ne sert qu'une fois.",
    '',
    "Si ce n'est pas toi, ignore ce message : ton mot de passe actuel reste",
    'valable, et personne ne peut le changer sans ce lien.',
  ].join('\n');
}

/**
 * Page rendue quand le voisin ouvre le lien depuis sa boîte.
 *
 * Elle n'est pas dans l'application : elle s'affiche dans le navigateur, sans
 * JavaScript, sans police à télécharger, sans rien à charger. C'est un aller
 * simple qui doit marcher même sur un vieux téléphone, dans le navigateur
 * intégré d'une application de courrier.
 */
export function pageDeConfirmation(options: {
  titre: string;
  message: string;
  réussi: boolean;
  lienApplication?: string;
}): string {
  const couleur = options.réussi ? '#0f7b6c' : '#b3261e';
  const échapper = (texte: string) =>
    texte.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
    );

  return `<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${échapper(options.titre)} — Jiran</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #faf7f2; color: #201b16; padding: 24px;
         font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .carte { background: #fff; border: 1px solid #e8e0d5; border-radius: 16px;
           padding: 32px 24px; max-width: 26rem; width: 100%; text-align: center;
           box-shadow: 0 1px 3px rgb(32 27 22 / 8%); }
  h1 { margin: 0 0 8px; font-size: 1.35rem; color: ${couleur}; }
  p { margin: 0 0 20px; color: #5f564c; }
  a.bouton { display: inline-block; background: #b4532a; color: #fff;
             text-decoration: none; font-weight: 600; padding: 12px 24px;
             border-radius: 999px; }
  @media (prefers-color-scheme: dark) {
    body { background: #17130f; color: #f3ede5; }
    .carte { background: #201b16; border-color: #3a322a; }
    p { color: #b5aa9c; }
  }
</style>
<div class="carte">
  <h1>${échapper(options.titre)}</h1>
  <p>${échapper(options.message)}</p>
  ${options.lienApplication ? `<a class="bouton" href="${échapper(options.lienApplication)}">Ouvrir Jiran</a>` : ''}
</div>
`;
}

/**
 * Formulaire de nouveau mot de passe, ouvert depuis la boîte aux lettres.
 *
 * Une page autonome plutôt qu'un écran de l'application : le lien s'ouvre dans
 * le navigateur intégré d'un client de courrier, où l'application n'est pas
 * forcément installée et où télécharger 350 Ko de JavaScript pour deux champs
 * n'aurait pas de sens.
 */
export function pageDeNouveauMotDePasse(jeton: string, longueurMinimale: number): string {
  const échapper = (texte: string) =>
    texte.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
    );

  return `<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nouveau mot de passe — Jiran</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #faf7f2; color: #201b16; padding: 24px;
         font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .carte { background: #fff; border: 1px solid #e8e0d5; border-radius: 16px;
           padding: 32px 24px; max-width: 26rem; width: 100%;
           box-shadow: 0 1px 3px rgb(32 27 22 / 8%); }
  h1 { margin: 0 0 4px; font-size: 1.35rem; }
  p { margin: 0 0 20px; color: #5f564c; font-size: .95rem; }
  label { display: block; font-weight: 600; margin-bottom: 6px; font-size: .9rem; }
  input { width: 100%; box-sizing: border-box; padding: 12px; font-size: 1rem;
          border: 1px solid #d6cbbc; border-radius: 10px; background: #fff;
          color: inherit; margin-bottom: 16px; }
  button { width: 100%; background: #b4532a; color: #fff; border: 0;
           font: inherit; font-weight: 600; padding: 13px; border-radius: 999px;
           cursor: pointer; }
  button[disabled] { opacity: .6; cursor: default; }
  .message { margin-top: 16px; font-size: .95rem; text-align: center; }
  .erreur { color: #b3261e; }
  .reussi { color: #0f7b6c; }
  @media (prefers-color-scheme: dark) {
    body { background: #17130f; color: #f3ede5; }
    .carte { background: #201b16; border-color: #3a322a; }
    p { color: #b5aa9c; }
    input { background: #17130f; border-color: #3a322a; }
  }
</style>
<div class="carte">
  <h1>Nouveau mot de passe</h1>
  <p>Choisis-en un d'au moins ${longueurMinimale} caractères.</p>
  <form id="f">
    <label for="mdp">Mot de passe</label>
    <input id="mdp" type="password" autocomplete="new-password" required
           minlength="${longueurMinimale}">
    <button type="submit">Enregistrer</button>
  </form>
  <p class="message" id="msg"></p>
</div>
<script>
  var jeton = ${JSON.stringify(jeton)};
  var f = document.getElementById('f');
  var msg = document.getElementById('msg');
  var textes = {
    mot_de_passe_trop_court: 'Mot de passe trop court.',
    mot_de_passe_trop_courant: 'Ce mot de passe est trop courant, choisis-en un autre.',
    jeton_expire: 'Ce lien a expiré. Redemande-en un depuis Jiran.',
    jeton_deja_utilise: 'Ce lien a déjà servi. Redemande-en un depuis Jiran.',
    jeton_inconnu: 'Ce lien ne correspond à rien.'
  };
  f.addEventListener('submit', function (evenement) {
    evenement.preventDefault();
    var bouton = f.querySelector('button');
    bouton.disabled = true;
    msg.className = 'message';
    msg.textContent = 'Enregistrement…';
    fetch('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: jeton, password: document.getElementById('mdp').value })
    }).then(function (r) {
      return r.json().then(function (corps) { return { ok: r.ok, corps: corps }; });
    }).then(function (r) {
      if (r.ok) {
        msg.className = 'message reussi';
        msg.textContent = 'C\'est fait. Tu peux te connecter sur Jiran.';
        f.style.display = 'none';
        return;
      }
      msg.className = 'message erreur';
      msg.textContent = textes[r.corps.error] || 'Impossible pour le moment.';
      bouton.disabled = false;
    }).catch(function () {
      msg.className = 'message erreur';
      msg.textContent = 'Serveur injoignable. Réessaie dans un instant.';
      bouton.disabled = false;
    });
  });
</script>
`;
}
