# Regional Logistics — Valuable State Authority

Online, the client is never authoritative for settlement stock, money, contract reward/completion, route event state, cart owner/controller/claim, cargo contents, faction membership, clan membership or roles.

Current offline owners execute those mutations only because the runtime is local. Each owner switches to its network bridge when `KeloNetAuthority.isOnline()` is true and refuses a local fallback when that bridge is unavailable.

Cargo secrecy is enforced at the projection boundary: unauthorized viewers receive only cart identity/state and `cargo: UNKNOWN`, never exact items, quantity or value.
