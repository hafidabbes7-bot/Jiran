import { DatabaseSync } from 'node:sqlite';

/**
 * Base du contenu : membres, publications, réponses, mentions « j'aime » et
 * signalements.
 *
 * SQLite intégré à Node, sans dépendance à installer. Suffisant pour un
 * quartier et pour un pilote ; le jour où plusieurs instances tournent, c'est
 * ce fichier qu'on remplace, pas les routes.
 *
 * Le module `node:sqlite` est marqué expérimental par Node : il affiche un
 * avertissement au démarrage, sans conséquence sur son fonctionnement.
 */
export function openDatabase(location: string): DatabaseSync {
  const db = new DatabaseSync(location);

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id              TEXT PRIMARY KEY,
      phone           TEXT NOT NULL UNIQUE,
      first_name      TEXT NOT NULL,
      neighborhood_id TEXT NOT NULL,
      building        TEXT,
      joined_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id              TEXT PRIMARY KEY,
      author_id       TEXT NOT NULL REFERENCES members(id),
      category        TEXT NOT NULL,
      body            TEXT NOT NULL,
      neighborhood_id TEXT NOT NULL,
      building        TEXT,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS posts_by_neighborhood
      ON posts (neighborhood_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS comments (
      id         TEXT PRIMARY KEY,
      post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id  TEXT NOT NULL REFERENCES members(id),
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS comments_by_post ON comments (post_id, created_at);

    CREATE TABLE IF NOT EXISTS likes (
      post_id   TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id),
      PRIMARY KEY (post_id, member_id)
    );

    -- La clé primaire porte la règle « un voisin ne compte qu'une fois » :
    -- même un client modifié ne peut pas signaler deux fois la même
    -- publication pour accélérer son blocage.
    CREATE TABLE IF NOT EXISTS reports (
      post_id     TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      reporter_id TEXT NOT NULL REFERENCES members(id),
      reason      TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      PRIMARY KEY (post_id, reporter_id)
    );
    CREATE INDEX IF NOT EXISTS reports_by_post ON reports (post_id, created_at);

    -- Ce qui s'est passé pour un voisin pendant qu'il n'était pas là (§4.17).
    -- La liste est tenue par le serveur : les notifications du téléphone
    -- peuvent ne jamais arriver, l'application doit pouvoir le rattraper.
    CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT PRIMARY KEY,
      member_id  TEXT NOT NULL REFERENCES members(id),
      kind       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      ref        TEXT,
      created_at TEXT NOT NULL,
      read_at    TEXT
    );
    CREATE INDEX IF NOT EXISTS notifications_by_member
      ON notifications (member_id, created_at DESC);

    -- Photos partagées dans le quartier (§4.3 et §4.8 du prototype).
    -- Les octets vivent dans la base, comme le reste : un disque local ne
    -- survivrait pas au redémarrage de l'hébergement, et un stockage externe
    -- demanderait un compte et une facture avant le premier essai.
    CREATE TABLE IF NOT EXISTS photos (
      id              TEXT PRIMARY KEY,
      owner_id        TEXT NOT NULL REFERENCES members(id),
      neighborhood_id TEXT NOT NULL,
      mime            TEXT NOT NULL,
      bytes           BLOB NOT NULL,
      created_at      TEXT NOT NULL
    );

    -- Stories : une photo et un mot, visibles 24 heures par le quartier.
    CREATE TABLE IF NOT EXISTS stories (
      id              TEXT PRIMARY KEY,
      author_id       TEXT NOT NULL REFERENCES members(id),
      neighborhood_id TEXT NOT NULL,
      photo_id        TEXT REFERENCES photos(id),
      body            TEXT,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stories_by_neighborhood
      ON stories (neighborhood_id, created_at DESC);

    -- Messages privés entre deux voisins (§4.6). La conversation n'est pas une
    -- ligne : elle se déduit de la paire, ce qui évite de créer un objet vide
    -- avant le premier message.
    CREATE TABLE IF NOT EXISTS messages (
      id           TEXT PRIMARY KEY,
      sender_id    TEXT NOT NULL REFERENCES members(id),
      recipient_id TEXT NOT NULL REFERENCES members(id),
      body         TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      read_at      TEXT
    );
    CREATE INDEX IF NOT EXISTS messages_by_pair
      ON messages (sender_id, recipient_id, created_at);
    CREATE INDEX IF NOT EXISTS messages_to
      ON messages (recipient_id, created_at DESC);

    -- Annuaire des artisans recommandés par de vrais voisins (§4.9).
    CREATE TABLE IF NOT EXISTS services (
      id              TEXT PRIMARY KEY,
      neighborhood_id TEXT NOT NULL,
      name            TEXT NOT NULL,
      trade           TEXT NOT NULL,
      phone           TEXT,
      added_by        TEXT NOT NULL REFERENCES members(id),
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS services_by_neighborhood ON services (neighborhood_id);

    -- Une recommandation par voisin et par artisan : la clé primaire l'impose.
    CREATE TABLE IF NOT EXISTS service_recommendations (
      service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      member_id  TEXT NOT NULL REFERENCES members(id),
      rating     INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (service_id, member_id)
    );

    -- Objets prêtés entre voisins (§4.10).
    CREATE TABLE IF NOT EXISTS items (
      id              TEXT PRIMARY KEY,
      neighborhood_id TEXT NOT NULL,
      owner_id        TEXT NOT NULL REFERENCES members(id),
      name            TEXT NOT NULL,
      status          TEXT NOT NULL,
      borrower_id     TEXT REFERENCES members(id),
      due_date        TEXT,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS items_by_neighborhood ON items (neighborhood_id, created_at DESC);

    -- Groupes d'intérêt et leurs fils (§4.11).
    CREATE TABLE IF NOT EXISTS groups (
      id              TEXT PRIMARY KEY,
      neighborhood_id TEXT NOT NULL,
      name            TEXT NOT NULL,
      emoji           TEXT NOT NULL,
      created_by      TEXT NOT NULL REFERENCES members(id),
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS groups_by_neighborhood ON groups (neighborhood_id);

    CREATE TABLE IF NOT EXISTS group_members (
      group_id  TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id),
      joined_at TEXT NOT NULL,
      PRIMARY KEY (group_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS group_posts (
      id         TEXT PRIMARY KEY,
      group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      author_id  TEXT NOT NULL REFERENCES members(id),
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS group_posts_by_group ON group_posts (group_id, created_at DESC);

    -- Points utiles du quartier (§4.12) : la distance se calcule à l'affichage.
    CREATE TABLE IF NOT EXISTS places (
      id              TEXT PRIMARY KEY,
      neighborhood_id TEXT NOT NULL,
      name            TEXT NOT NULL,
      kind            TEXT NOT NULL,
      latitude        REAL NOT NULL,
      longitude       REAL NOT NULL,
      added_by        TEXT NOT NULL REFERENCES members(id),
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS places_by_neighborhood ON places (neighborhood_id);

    -- Mode vacances (§4.13) : une absence déclarée, et les voisins nommément
    -- désignés pour veiller. Personne d'autre ne la voit — une absence connue
    -- de tout le quartier serait une invitation au cambriolage.
    CREATE TABLE IF NOT EXISTS vacations (
      id         TEXT PRIMARY KEY,
      member_id  TEXT NOT NULL REFERENCES members(id),
      starts_on  TEXT NOT NULL,
      ends_on    TEXT NOT NULL,
      note       TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS vacations_by_member ON vacations (member_id, ends_on DESC);

    CREATE TABLE IF NOT EXISTS vacation_watchers (
      vacation_id TEXT NOT NULL REFERENCES vacations(id) ON DELETE CASCADE,
      member_id   TEXT NOT NULL REFERENCES members(id),
      PRIMARY KEY (vacation_id, member_id)
    );

    -- Calendrier de collecte des déchets (§4.14), renseigné par les voisins.
    CREATE TABLE IF NOT EXISTS waste_slots (
      id              TEXT PRIMARY KEY,
      neighborhood_id TEXT NOT NULL,
      kind            TEXT NOT NULL,
      weekday         INTEGER NOT NULL,
      hour            TEXT NOT NULL,
      updated_by      TEXT NOT NULL REFERENCES members(id),
      updated_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS waste_by_neighborhood ON waste_slots (neighborhood_id, weekday);

    -- Actions solidaires (§4.15) et leurs participants.
    CREATE TABLE IF NOT EXISTS solidarity_actions (
      id              TEXT PRIMARY KEY,
      neighborhood_id TEXT NOT NULL,
      title           TEXT NOT NULL,
      kind            TEXT NOT NULL,
      details         TEXT,
      happens_on      TEXT,
      created_by      TEXT NOT NULL REFERENCES members(id),
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS solidarity_by_neighborhood
      ON solidarity_actions (neighborhood_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS solidarity_participants (
      action_id TEXT NOT NULL REFERENCES solidarity_actions(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id),
      joined_at TEXT NOT NULL,
      PRIMARY KEY (action_id, member_id)
    );

    -- Parties entre voisins. Le plateau et le tour vivent ici : c'est le
    -- serveur qui arbitre, pas le téléphone (§7.6).
    CREATE TABLE IF NOT EXISTS games (
      id              TEXT PRIMARY KEY,
      kind            TEXT NOT NULL,
      neighborhood_id TEXT NOT NULL,
      player_x        TEXT NOT NULL REFERENCES members(id),
      player_o        TEXT REFERENCES members(id),
      board           TEXT NOT NULL,
      turn            TEXT NOT NULL,
      status          TEXT NOT NULL,
      winner          TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS games_by_neighborhood
      ON games (neighborhood_id, updated_at DESC);

    -- Un voisin peut avoir plusieurs appareils ; un jeton n'appartient qu'à un
    -- seul voisin, d'où la clé primaire sur le jeton.
    CREATE TABLE IF NOT EXISTS devices (
      token      TEXT PRIMARY KEY,
      member_id  TEXT NOT NULL REFERENCES members(id),
      platform   TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS devices_by_member ON devices (member_id);

    -- Décision d'un modérateur sur une publication : elle prime sur le
    -- compteur automatique. Une seule décision courante par publication.
    CREATE TABLE IF NOT EXISTS moderation_decisions (
      post_id      TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
      moderator_id TEXT NOT NULL REFERENCES members(id),
      decision     TEXT NOT NULL,
      note         TEXT,
      decided_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sos_alerts (
      id          TEXT PRIMARY KEY,
      member_id   TEXT NOT NULL REFERENCES members(id),
      latitude    REAL,
      longitude   REAL,
      created_at  TEXT NOT NULL,
      cancelled_at TEXT
    );

    -- Qui a été prévenu : le voisin choisit lui-même ses destinataires (§4.16),
    -- il faut donc pouvoir les retrouver pour l'annulation.
    CREATE TABLE IF NOT EXISTS sos_targets (
      alert_id  TEXT NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id),
      PRIMARY KEY (alert_id, member_id)
    );
  `);

  ajouterColonne(db, 'posts', 'photo_id', 'TEXT');

  return db;
}

/**
 * Ajoute une colonne à une table existante, si elle n'y est pas déjà.
 *
 * `CREATE TABLE IF NOT EXISTS` ne touche pas une table déjà créée : sans ça,
 * une base née avant cette colonne resterait sans photo pour toujours.
 */
function ajouterColonne(db: DatabaseSync, table: string, colonne: string, type: string): void {
  const colonnes = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (colonnes.some((c) => c.name === colonne)) return;

  db.exec(`ALTER TABLE ${table} ADD COLUMN ${colonne} ${type}`);
}
