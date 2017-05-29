/**
 * Turns a string into a slug by converting the string to lowercase, converting
 * any series of non-alphanumeric characters to dashes and trimming dashes from
 * the beginning and end of the final slug.
 *
 * This makes the string usable in a URL or a filename without encoding with a
 * bunch of wierd % symbols.
 *
 * After running this function you are guaranteed that the resulting slug will
 * only have lowercase alphanumeric characters and dashes.
 */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/ig, '-')
      .replace(/^-/, '')
      .replace(/-$/, '')
  );
}
