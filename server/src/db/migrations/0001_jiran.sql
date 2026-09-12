-- Schéma initial de Jiran.
--
-- Une seule règle tient tout : chaque contenu appartient à un membre et à un
-- quartier, et disparaît proprement quand son parent disparaît — d'où les
-- ON DELETE CASCADE. Aucune donnée orpheline ne doit pouvoir survivre.
--
-- Les quartiers ne sont pas une table : les 1554 communes et provinces vivent
-- dans le code, partagées telles quelles avec l'application, qui en a besoin
-- hors ligne pour choisir son quartier et vérifier une position. Les colonnes
-- `neighborhood_id` portent cet identifiant stable.

CREATE TABLE members (
  id              UUID PRIMARY KEY,
  -- Numéro de téléphone normalisé ou adresse e-mail, vérifié : c'est lui qui
  -- possède l'historique du compte, pas l'appareil.
  identifier      TEXT NOT NULL UNIQUE,
  identifier_kind TEXT NOT NULL CHECK (identifier_kind IN ('phone', 'email')),
  first_name      TEXT NOT NULL,
  neighborhood_id TEXT NOT NULL,
  building        TEXT,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX members_by_neighborhood ON members (neighborhood_id);

-- Photos. Les octets ne sont ici qu'en dernier recours : quand Supabase
-- Storage est configuré, seule l'adresse publique est conservée.
CREATE TABLE photos (
  id              UUID PRIMARY KEY,
  owner_id        UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  neighborhood_id TEXT NOT NULL,
  mime            TEXT NOT NULL,
  storage_path    TEXT,
  public_url      TEXT,
  bytes           BYTEA,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (storage_path IS NOT NULL OR bytes IS NOT NULL)
);

CREATE TABLE posts (
  id              UUID PRIMARY KEY,
  author_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN ('securite', 'entraide', 'annonce', 'evenement')),
  body            TEXT NOT NULL,
  neighborhood_id TEXT NOT NULL,
  building        TEXT,
  photo_id        UUID REFERENCES photos(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX posts_by_neighborhood ON posts (neighborhood_id, created_at DESC);
CREATE INDEX posts_by_author ON posts (author_id);

CREATE TABLE comments (
  id         UUID PRIMARY KEY,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_by_post ON comments (post_id, created_at);

-- La clé primaire porte la règle « un voisin n'aime qu'une fois ».
CREATE TABLE likes (
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, member_id)
);

-- Même idée pour les signalements : trois signalements, c'est trois personnes
-- différentes. Un client modifié ne peut pas accélérer un blocage.
CREATE TABLE reports (
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, reporter_id)
);
CREATE INDEX reports_by_post ON reports (post_id, created_at);

-- Décision d'un modérateur : elle prime sur le compteur automatique.
CREATE TABLE moderation_decisions (
  post_id     UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  decision    TEXT NOT NULL CHECK (decision IN ('block', 'restore')),
  note        TEXT,
  moderator_id TEXT NOT NULL,
  decided_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  token      TEXT PRIMARY KEY,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  platform   TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX devices_by_member ON devices (member_id);

CREATE TABLE sos_alerts (
  id           UUID PRIMARY KEY,
  member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  latitude     DOUBLE PRECISION,
  longitude    DOUBLE PRECISION,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);

CREATE TABLE sos_targets (
  alert_id  UUID NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (alert_id, member_id)
);

-- Messagerie privée. La conversation existe comme objet à part entière : deux
-- voisins n'en ont qu'une, quel que soit celui qui écrit le premier.
CREATE TABLE conversations (
  id              UUID PRIMARY KEY,
  member_low      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_high     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (member_low < member_high),
  UNIQUE (member_low, member_high)
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at         TIMESTAMPTZ
);
CREATE INDEX messages_by_conversation ON messages (conversation_id, created_at);
CREATE INDEX messages_unread ON messages (recipient_id) WHERE read_at IS NULL;

CREATE TABLE notifications (
  id         UUID PRIMARY KEY,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  ref        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at    TIMESTAMPTZ
);
CREATE INDEX notifications_by_member ON notifications (member_id, created_at DESC);

CREATE TABLE stories (
  id              UUID PRIMARY KEY,
  author_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  neighborhood_id TEXT NOT NULL,
  photo_id        UUID REFERENCES photos(id) ON DELETE SET NULL,
  body            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stories_by_neighborhood ON stories (neighborhood_id, created_at DESC);

CREATE TABLE games (
  id              UUID PRIMARY KEY,
  kind            TEXT NOT NULL,
  neighborhood_id TEXT NOT NULL,
  player_x        UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  player_o        UUID REFERENCES members(id) ON DELETE CASCADE,
  board           TEXT NOT NULL,
  turn            TEXT NOT NULL,
  status          TEXT NOT NULL,
  winner          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX games_by_neighborhood ON games (neighborhood_id, updated_at DESC);

CREATE TABLE services (
  id              UUID PRIMARY KEY,
  neighborhood_id TEXT NOT NULL,
  name            TEXT NOT NULL,
  trade           TEXT NOT NULL,
  phone           TEXT,
  added_by        UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX services_by_neighborhood ON services (neighborhood_id);

CREATE TABLE service_recommendations (
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, member_id)
);

CREATE TABLE items (
  id              UUID PRIMARY KEY,
  neighborhood_id TEXT NOT NULL,
  owner_id        UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('disponible', 'emprunte')),
  borrower_id     UUID REFERENCES members(id) ON DELETE SET NULL,
  due_date        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX items_by_neighborhood ON items (neighborhood_id, created_at DESC);

CREATE TABLE groups (
  id              UUID PRIMARY KEY,
  neighborhood_id TEXT NOT NULL,
  name            TEXT NOT NULL,
  emoji           TEXT NOT NULL,
  created_by      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX groups_by_neighborhood ON groups (neighborhood_id);

CREATE TABLE group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, member_id)
);

CREATE TABLE group_posts (
  id         UUID PRIMARY KEY,
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX group_posts_by_group ON group_posts (group_id, created_at DESC);

CREATE TABLE places (
  id              UUID PRIMARY KEY,
  neighborhood_id TEXT NOT NULL,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  added_by        UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX places_by_neighborhood ON places (neighborhood_id);

CREATE TABLE vacations (
  id         UUID PRIMARY KEY,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  starts_on  TEXT NOT NULL,
  ends_on    TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vacations_by_member ON vacations (member_id, ends_on DESC);

CREATE TABLE vacation_watchers (
  vacation_id UUID NOT NULL REFERENCES vacations(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (vacation_id, member_id)
);

CREATE TABLE waste_slots (
  id              UUID PRIMARY KEY,
  neighborhood_id TEXT NOT NULL,
  kind            TEXT NOT NULL,
  weekday         INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  hour            TEXT NOT NULL,
  updated_by      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX waste_by_neighborhood ON waste_slots (neighborhood_id, weekday);

CREATE TABLE solidarity_actions (
  id              UUID PRIMARY KEY,
  neighborhood_id TEXT NOT NULL,
  title           TEXT NOT NULL,
  kind            TEXT NOT NULL,
  details         TEXT,
  happens_on      TEXT,
  created_by      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX solidarity_by_neighborhood ON solidarity_actions (neighborhood_id, created_at DESC);

CREATE TABLE solidarity_participants (
  action_id UUID NOT NULL REFERENCES solidarity_actions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (action_id, member_id)
);
