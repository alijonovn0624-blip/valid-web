// Colour themes. "dark" and "light" were the originals; "blue" (Lazuli) and "green" are the two extra ones.
export const THEMES = ['dark', 'light', 'blue', 'green'];
export const isTheme = (v) => THEMES.includes(v);
export const nextTheme = (v) => THEMES[(THEMES.indexOf(v) + 1) % THEMES.length];
export const themeIcon = (v) => ({ dark: 'moon', light: 'sun', blue: 'droplet', green: 'leaf' }[v] || 'moon');
export const themeKey = (v) => ({ dark: 'dark', light: 'light', blue: 'themeBlue', green: 'themeGreen' }[v] || 'dark');
