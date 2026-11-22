const files = import.meta.glob<string>('../assets/sprites/*.webp', { eager: true, query: '?url', import: 'default' });

/** キャラクターの絵のファイル（名前 → URL）。名前は SPRITES の name と同じ */
export const CHAR_ART: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace(/^.*\/(.+)\.webp$/, '$1'), url]),
);

export function artKey(name: string): string {
  return `art:${name}`;
}
