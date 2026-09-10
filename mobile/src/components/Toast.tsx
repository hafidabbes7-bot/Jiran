import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { colors, fontSizes, radii, spacing } from '../theme/theme';

type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** Message court et transitoire, comme le toast du prototype. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ShowToast>((next) => {
    setMessage(next);
  }, []);

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setMessage(null);
        }
      );
    }, 2200);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [message, opacity]);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast doit être utilisé dans un ToastProvider');
  return value;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 110,
    backgroundColor: colors.ink,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  text: { color: colors.paper, fontSize: fontSizes.small, textAlign: 'center' },
});
