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
  `);

  return db;
}
