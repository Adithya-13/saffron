import { useEffect } from 'react';
import { DEFAULT_THEME } from '@saffron/protocol';
import type { Theme } from '@saffron/protocol';

export const THEME_INFO: Readonly<Record<Theme, { readonly label: string; readonly bar: string }>> =
  {
    paper: { label: 'Paper', bar: '#f4eee3' },
    night: { label: 'Night', bar: '#15132b' },
    harbour: { label: 'Harbour', bar: '#e8edef' },
  };

const applyTheme = (theme: Theme): void => {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_INFO[theme].bar);
};

export const useRoomTheme = (theme: Theme | undefined): void => {
  useEffect(() => {
    applyTheme(theme ?? DEFAULT_THEME);
    return () => applyTheme(DEFAULT_THEME);
  }, [theme]);
};
