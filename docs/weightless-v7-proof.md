# Weightless V7 — Exact Full PNG Proof

- `plazaFountainKelo`: SOURCE `assets/justicia_fountain_v2.PNG` 3,040,977 B -> DELIVERY `assets/pf-f5ba82df.png` 2,329,441 B; saved 711,536 B (23.398%). SHA-256 `f5ba82df1680b758980489a56543d59311ca4c0a6a39d0899d8e434332beb239`.
- `plazaRoundTree`: SOURCE `assets/world/imperial-plaza/arbol-redondo.png` 2,114,475 B -> DELIVERY `assets/prt-fc9790cb.png` 1,581,201 B; saved 533,274 B (25.220%). SHA-256 `fc9790cbc6e907d32ec1bfbdbb6a4220cb9c2099f35bc5cb83a35da81442479a`.
- Combined measured SOURCE 5,155,452 B -> DELIVERY 3,910,642 B; saved 1,244,810 B (24.146%).
- Both remain PNG 1254x1254 and decode to byte-identical full RGBA.
- Alpha trim was rejected for runtime because it adds only 3,127 B of combined saving over exact full PNG while requiring geometry remapping.
- Canonical SOURCE files remain untouched.
- Runtime changes only the two asset URLs in `src/environment/prop-contract.js`; positions, colliders, sizes, frames and renderer are unchanged.
- Final promotion still requires PR gates: Asset Bit Ratchet, Boot Footprint V2, Observed Boot Transfer V3 and Main Stability/mobile smoke.
