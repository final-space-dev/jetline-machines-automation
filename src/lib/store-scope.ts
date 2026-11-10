/**
 * Scoping a person who is not an admin to their own store.
 *
 * Someone with no store of their own (a custom-access user) must see nothing
 * that belongs to a store, so their queries are given a store name no store
 * has. It has to be ordinary text: the value used to begin with a NUL
 * character, which Postgres refuses ("invalid byte sequence for encoding
 * UTF8: 0x00"), so every such request failed with a 500.
 */
export const NO_STORE = "__none__";

/** The person's own store, or the name no store has. */
export function ownStoreOrNothing(store: string | null | undefined): string {
  return store || NO_STORE;
}
