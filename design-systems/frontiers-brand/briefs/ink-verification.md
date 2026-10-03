# Brief: verifying the decoration kit's ink matches

**For:** whoever orders goods. **Governs:** `../spec.md` FR-017; `frontiers-merchandise` FR-008.

Every ink in the decoration kit (`tokens.json`, `$extensions["com.intellectualfrontiers.decoration"].inks`) names a
Pantone spot color and an Isacord thread chosen from published color data. Screens and published values are not the
physical ink, so each stays `verified: false` until checked, and `frontiers-merchandise` refuses an order (a job with
`"order": true`) that uses an unverified ink. A proof may use one.

## How to verify an ink

1. Get the current physical guides: a Pantone Formula Guide (Solid Coated) and the Isacord 40 thread card, not more
   than a few years old (they fade).
2. Print the role's color on the stock the goods use, or ask the decorator for a physical sample, and compare it with
   the named chip and thread under daylight (D50/D65) light.
3. If the named match is the closest, record it. If another chip or thread is closer, record that one instead.
4. Record it with the tool, which writes the match, who checked it and when into `tokens.json`:

       python3 tools/brand_decoration.py verify design-systems/frontiers-brand --ink primary \
           --spot "7686 C" --thread 3332 --by "A. Checker" --on 2026-10-10

5. Commit the change. The ink is then orderable.
