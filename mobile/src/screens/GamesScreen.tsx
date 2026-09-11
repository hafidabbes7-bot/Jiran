import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import type { Game } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { useApp } from '../state/AppProvider';
import { colors, fontSizes, radii, spacing } from '../theme/theme';

/** Cadence de rafraîchissement : assez vive pour suivre le tour d'en face. */
const POLL_MS = 3000;

/**
 * Jeux entre voisins (§4.8), en commençant par un morpion réellement jouable
 * (§7.6) : le plateau et le tour viennent du serveur, l'écran ne fait que
 * montrer et transmettre. Deux voisins jouent donc vraiment l'un contre
 * l'autre, chacun sur son téléphone.
 */
export function GamesScreen() {
  const { s, format, rtl } = useI18n();
  const { loadGames, createGame, joinGame, playMove } = useApp();

  const [games, setGames] = useState<Game[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const monté = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const list = await loadGames();
      if (monté.current) {
        setGames(list);
        setFailed(false);
      }
    } catch {
      if (monté.current) setFailed(true);
    }
  }, [loadGames]);

  useEffect(() => {
    monté.current = true;
    refresh();
    // Le serveur ne peut pas nous prévenir : on redemande, comme pour le fil.
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      monté.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  /** Applique le résultat d'une action sans attendre le prochain rafraîchissement. */
  const remplace = (game: Game) =>
    setGames((current) => {
      const others = current.filter((item) => item.id !== game.id);
      return [game, ...others];
    });

  const agir = async (action: () => Promise<Game>, ouvrir = true) => {
    if (busy) return;
    setBusy(true);
    try {
      const game = await action();
      remplace(game);
      if (ouvrir) setOpenId(game.id);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const mine = games.filter((game) => game.yourMark);
  const open = games.filter((game) => !game.yourMark && game.status === 'waiting');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, rtl.text]}>{s.games.intro}</Text>

      <PrimaryButton
        label={s.games.create}
        loading={busy}
        onPress={() => agir(() => createGame())}
      />

      {failed ? <Text style={[styles.failed, rtl.text]}>{s.games.failed}</Text> : null}

      <Text style={[styles.section, rtl.text]}>{s.games.mine}</Text>
      {mine.length === 0 ? (
        <Text style={[styles.empty, rtl.text]}>{s.games.noneMine}</Text>
      ) : (
        mine.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            opened={openId === game.id}
            onToggle={() => setOpenId(openId === game.id ? null : game.id)}
            onPlay={(cell) => agir(() => playMove(game.id, cell))}
          />
        ))
      )}

      <Text style={[styles.section, rtl.text]}>{s.games.open}</Text>
      {open.length === 0 ? (
        <Text style={[styles.empty, rtl.text]}>{s.games.noneOpen}</Text>
      ) : (
        open.map((game) => (
          <View key={game.id} style={styles.card}>
            <Text style={[styles.cardTitle, rtl.text]}>
              {format(s.games.waitingFor, { name: game.hostName })}
            </Text>
            <PrimaryButton
              label={s.games.join}
              tone="ghost"
              onPress={() => agir(() => joinGame(game.id))}
              style={styles.spaced}
            />
          </View>
        ))
      )}
    </ScrollView>
  );
}

function GameCard({
  game,
  opened,
  onToggle,
  onPlay,
}: {
  game: Game;
  opened: boolean;
  onToggle: () => void;
  onPlay: (cell: number) => void;
}) {
  const { s, format, rtl } = useI18n();

  const adversaire = game.yourMark === 'X' ? game.opponentName : game.hostName;

  const état = () => {
    if (game.outcome === 'gagne') return s.games.youWon;
    if (game.outcome === 'perdu') return s.games.youLost;
    if (game.outcome === 'nul') return s.games.draw;
    if (game.status === 'waiting') return s.games.waitingOpponent;
    return game.yourTurn ? s.games.yourTurn : format(s.games.theirTurn, { name: adversaire ?? '' });
  };

  const jouable = game.status === 'playing' && game.yourTurn;

  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" onPress={onToggle}>
        <Text style={[styles.cardTitle, rtl.text]}>
          {adversaire ? format(s.games.against, { name: adversaire }) : s.games.waitingOpponent}
        </Text>
        <Text style={[styles.cardState, game.yourTurn && styles.cardStateActive, rtl.text]}>
          {état()}
        </Text>
      </Pressable>

      {opened ? (
        <View style={styles.board}>
          {Array.from({ length: 9 }, (_, cell) => {
            const value = game.board[cell];
            return (
              <Pressable
                key={cell}
                accessibilityRole="button"
                accessibilityLabel={format(s.games.cell, { number: cell + 1 })}
                disabled={!jouable || value !== '.'}
                onPress={() => onPlay(cell)}
                style={styles.cell}
              >
                <Text style={[styles.cellText, value === 'O' && styles.cellO]}>
                  {value === '.' ? '' : value}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.openHint, rtl.text]}>{s.games.openBoard}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { fontSize: fontSizes.small, color: colors.muted, marginBottom: spacing.md },
  section: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: fontSizes.small,
    fontWeight: '700',
    color: colors.muted,
  },
  empty: { fontSize: fontSizes.small, color: colors.muted },
  failed: { marginTop: spacing.sm, fontSize: fontSizes.small, color: colors.alert },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: fontSizes.body, fontWeight: '700', color: colors.ink },
  cardState: { marginTop: 2, fontSize: fontSizes.small, color: colors.muted },
  cardStateActive: { color: colors.brand, fontWeight: '700' },
  openHint: { marginTop: spacing.xs, fontSize: fontSizes.caption, color: colors.muted },
  spaced: { marginTop: spacing.sm },
  board: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    width: 240,
  },
  cell: {
    width: 80,
    height: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontSize: 34, fontWeight: '700', color: colors.brand },
  cellO: { color: colors.ink },
});
