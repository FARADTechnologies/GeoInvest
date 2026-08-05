// Shared text search for the listing / rayon tables.
//
// The old check concatenated the fields and ran one `includes()`, which broke in
// two ways: a query typed with Turkish letters ("Güneşli") never matched the
// Azerbaijani spelling in the data ("Günəşli"), and multi-word queries only
// matched when the words happened to sit next to each other in that exact order
// ("Yeni Günəşli" found nothing, plain "Gün" found everything).

/** Fold case and strip the diacritics that differ between AZ and TR keyboards. */
export function normalize(text: string): string {
  return (
    text
      .toLocaleLowerCase("az")
      // ə/ä → e so "Günəşli", "Güneşli" and "Guneshli" all land on the same key
      .replace(/[əä]/g, "e")
      .replace(/[ıíìî]/g, "i")
      .replace(/[şś]/g, "s")
      .replace(/[çć]/g, "c")
      .replace(/[ğ]/g, "g")
      .replace(/[öó]/g, "o")
      .replace(/[üú]/g, "u")
      .normalize("NFD")
      // Drop any remaining combining marks (é → e, and the i̇ that
      // toLowerCase() produces for a dotted capital İ).
      .replace(/[̀-ͯ]/g, "")
  );
}

/**
 * True when every word in `query` appears somewhere in `fields`.
 *
 * Words may match different fields and in any order, so "Günəşli Xətai" finds a
 * listing whose address holds one and whose rayon holds the other.
 */
export function matchesQuery(query: string, fields: (string | number | null | undefined)[]): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalize(fields.filter((f) => f != null).join(" "));
  return terms.every((term) => haystack.includes(term));
}
