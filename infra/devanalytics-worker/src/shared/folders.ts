/** Lists the folders that contain a file, from the top: `src/main/a.ts` gives `src` and `src/main`. */
export function folderPrefixes(file: string): string[] {
  const parts = file.split('/').slice(0, -1);
  return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
}
