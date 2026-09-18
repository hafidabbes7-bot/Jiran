-- Comptes par adresse e-mail et mot de passe.
--
-- Séparé de `members` à dessein : un compte naît à l'inscription, avant que le
-- voisin ait choisi son prénom et son quartier. `members` porte le profil dans
-- le quartier ; `credentials` porte la preuve d'identité. Les deux se
-- rejoignent par l'identifiant vérifié — la même colonne que celle du parcours
-- par téléphone, pour qu'il n'y ait qu'une seule notion de « qui ».
--
-- Un compte par téléphone n'a pas de ligne ici : sa preuve est le code reçu,
-- il n'a pas de mot de passe à garder.
CREATE TABLE credentials (
  -- Adresse e-mail normalisée (minuscules). Même valeur que members.identifier.
  identifier      TEXT PRIMARY KEY,
  password_hash   TEXT NOT NULL,
  -- Renseigné quand le lien de confirmation a été ouvert. Tant qu'il est nul,
  -- la connexion est refusée : sans quoi n'importe qui s'inscrirait sous
  -- l'adresse d'un voisin.
  verified_at     TIMESTAMPTZ,
  -- Échecs consécutifs, remis à zéro par une connexion réussie. Sert à ralentir
  -- celui qui essaie des mots de passe en série.
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Liens envoyés par e-mail. Seule l'empreinte du jeton est gardée.
CREATE TABLE email_tokens (
  token_hash  TEXT PRIMARY KEY,
  identifier  TEXT NOT NULL,
  purpose     TEXT NOT NULL CHECK (purpose IN ('confirmation', 'reset')),
  expires_at  TIMESTAMPTZ NOT NULL,
  -- Un lien ne sert qu'une fois : rempli à l'ouverture.
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Retrouver les liens en cours d'une adresse : pour les invalider quand un
-- nouveau part, et pour faire le ménage des périmés.
CREATE INDEX email_tokens_identifier ON email_tokens (identifier, purpose);
CREATE INDEX email_tokens_expires ON email_tokens (expires_at);
