// What is different about each chain's shelf labels.
// The shared rules in parseLabel.ts handle everything else.
//
// Add a setting here only when it reflects how a chain designs its labels,
// confirmed on the shelf, not to fix a single photo.

export type StoreProfile = {
  // Dunnes: sale labels show "ONLY €4", with the old price struck through
  // above "SAVE 89c". The price you pay = old price − saving.
  saveArithmetic: boolean;

  // Tesco: Clubcard deals read "Any 2 … for €5" in the right-hand panel.
  anyNForDeal: boolean;

  // Tesco: cents printed as a separate small number, "€8" + "35" = €8.35.
  superscriptCents: boolean;
};

const SHARED_RULES_ONLY: StoreProfile = {
  saveArithmetic: false,
  anyNForDeal: false,
  superscriptCents: false,
};

const PROFILES: Record<string, StoreProfile> = {
  dunnes: { ...SHARED_RULES_ONLY, saveArithmetic: true },
  tesco: { ...SHARED_RULES_ONLY, anyNForDeal: true, superscriptCents: true },
};

// Accepts "Dunnes", "Dunnes Stores", "TESCO" and so on.
// Stores without a profile yet (Aldi, Centra, Lidl, SuperValu, Spar) use the shared rules.
export function profileFor(store: string): StoreProfile {
  const key = store.trim().toLowerCase().split(/\s+/)[0];
  return PROFILES[key] ?? SHARED_RULES_ONLY;
}
