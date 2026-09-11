import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AuthService,
  Challenge,
  Channel,
  CodeChallenge,
  LinkChallenge,
  VerifiedSession,
} from '../../data/authService';
import { normalizeEmail } from '../../domain/email';
import { normalizePhone } from '../../domain/phone';

export type VerificationStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'awaiting-code'; challenge: CodeChallenge }
  | { kind: 'verifying'; challenge: CodeChallenge }
  /** Canal gratuit : on attend que le voisin envoie son message WhatsApp. */
  | { kind: 'awaiting-link'; challenge: LinkChallenge };

export interface VerificationError {
  /** Clé de message, résolue en texte par l'écran. */
  key:
    | 'invalid_phone'
    | 'sms_failed'
    | 'channel_unavailable'
    | 'network'
    | 'rate_limited'
    | 'invalid_code'
    | 'expired'
    | 'consumed'
    | 'not_found'
    | 'too_many_attempts'
    | 'link_expired';
  attemptsLeft?: number;
  retryAfterSeconds?: number;
}

/**
 * Pilote la vérification du numéro : demande du code, décompte avant un
 * nouvel envoi, saisie et contrôle du code.
 *
 * Toute la décision appartient au serveur — ce hook ne fait qu'enchaîner les
 * appels et tenir l'état de l'écran.
 */
export function usePhoneVerification(auth: AuthService) {
  const [status, setStatus] = useState<VerificationStatus>({ kind: 'idle' });
  const [error, setError] = useState<VerificationError | null>(null);
  const [secondsBeforeResend, setSecondsBeforeResend] = useState(0);
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCountdown = useCallback(() => {
    if (countdown.current) {
      clearInterval(countdown.current);
      countdown.current = null;
    }
  }, []);

  const startCountdown = useCallback(
    (resendAfter: number) => {
      stopCountdown();
      const tick = () => {
        const remaining = Math.ceil((resendAfter - Date.now()) / 1000);
        setSecondsBeforeResend(Math.max(0, remaining));
        if (remaining <= 0) stopCountdown();
      };
      tick();
      countdown.current = setInterval(tick, 1000);
    },
    [stopCountdown]
  );

  useEffect(() => stopCountdown, [stopCountdown]);

  /** Renvoie le défi créé, ou `null` si l'envoi a échoué. */
  const requestCode = useCallback(
    async (phone: string, channel: Channel): Promise<Challenge | null> => {
      setError(null);
      setStatus({ kind: 'sending' });

      // Une adresse part telle quelle : la normalisation des numéros retire
      // les points et les espaces, ce qui découperait « prenom.nom@… ».
      const identifiant = channel === 'email' ? normalizeEmail(phone) : normalizePhone(phone);
      const result = await auth.requestCode(identifiant, channel);

      if (!result.ok) {
        setStatus({ kind: 'idle' });
        setError(
          result.reason === 'cooldown' || result.reason === 'rate_limited'
            ? { key: 'rate_limited', retryAfterSeconds: result.retryAfterSeconds }
            : { key: result.reason }
        );
        return null;
      }

      const { ok: _ignored, ...challenge } = result;

      if (challenge.mode === 'link') {
        setStatus({ kind: 'awaiting-link', challenge });
      } else {
        setStatus({ kind: 'awaiting-code', challenge });
        startCountdown(challenge.resendAfter);
      }
      // Le défi est renvoyé plutôt que lu dans `status` juste après l'appel :
      // l'état n'est pas encore à jour dans la fonction qui vient d'appeler.
      return challenge;
    },
    [auth, startCountdown]
  );

  const verifyCode = useCallback(
    async (code: string): Promise<VerifiedSession | null> => {
      if (status.kind !== 'awaiting-code') return null;

      const { challenge } = status;
      setError(null);
      setStatus({ kind: 'verifying', challenge });

      const result = await auth.verifyCode(challenge.challengeId, code);

      if (result.ok) {
        stopCountdown();
        return { identifier: result.identifier, token: result.token };
      }

      setStatus({ kind: 'awaiting-code', challenge });
      setError(
        result.reason === 'invalid_code'
          ? { key: 'invalid_code', attemptsLeft: result.attemptsLeft }
          : { key: result.reason }
      );
      return null;
    },
    [auth, status, stopCountdown]
  );

  /**
   * Attend le message WhatsApp du voisin : le serveur ne peut pas nous
   * prévenir, on redemande donc régulièrement jusqu'à confirmation.
   */
  const waitForLink = useCallback(
    async (onVerified: (session: VerifiedSession) => void) => {
      if (status.kind !== 'awaiting-link') return;
      const { challengeId } = status.challenge;

      const result = await auth.claimLink(challengeId);
      if (result.ok) {
        onVerified({ identifier: result.identifier, token: result.token });
        return;
      }

      // « pending » est le cas normal tant que rien n'est arrivé ; une panne
      // réseau passagère ne doit pas non plus interrompre l'attente.
      if (result.reason === 'pending' || result.reason === 'network') return;
      setError({ key: 'link_expired' });
    },
    [auth, status]
  );

  /** Retour à la saisie du numéro, par exemple pour corriger une faute. */
  const reset = useCallback(() => {
    stopCountdown();
    setStatus({ kind: 'idle' });
    setError(null);
    setSecondsBeforeResend(0);
  }, [stopCountdown]);

  return { status, error, secondsBeforeResend, requestCode, verifyCode, waitForLink, reset };
}
