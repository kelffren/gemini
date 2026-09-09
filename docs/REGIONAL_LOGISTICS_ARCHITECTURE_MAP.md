# Architecture Map — Regional Economy & Logistics

```text
UI / Devtools
   │ intents only
   ▼
┌─────────────────────────┐
│ Authority boundaries    │
│ KeloRegionalEconomy     │
│ KeloCaravans            │
│ KeloFactions            │
└──────────┬──────────────┘
           │
   offline │ local request
   online  │ KeloNetAuthority bridge
           ▼
┌─────────────────────────────────────────────┐
│ Domain                                      │
│ Settlement reserves / quotes / contracts   │
│ Route graph / risk / economic distance     │
│ Cart lifecycle / owner / controller        │
│ Faction membership / clans / permissions   │
└───────┬───────────────────────┬─────────────┘
        │                       │
        ▼                       ▼
 KeloContainers          KeloEvents
 real item movement      semantic events
        │
        ▼
 STATE/saveState offline
```

## Economy flow

```text
Settlement stock ↓
  → scarcity ↑
  → SupplyContract
  → destination pressure
  → Dijkstra economic distance
      travel cost + system-controlled risk
  → demand attenuation
  → origin price
  → potential margin
  → physical cart transport
  → delivery or robbery
  → settlement stock changes
  → quote/contracts recalculate
```

## Route risk flow

```text
RouteEdge base risk
 + WorldEvent modifier (RaiderBand)
 = effective risk
 → economic edge cost
 → shortest economic path
 → propagated demand
 → source market price
```

## Cart flow

```text
PARKED/DROPPED
  │ AttachCart
  ▼
ATTACHED ── carrier death ──► DROPPED
  │ DetachCart                  │
  └─────────────────────────────┘
                               │ BeginClaimCart
                               ▼
                           CLAIMING
                         damage │  │ timer complete
                                ▼  ▼
                            DROPPED ATTACHED(new controller)
```

Owner is never inferred from current controller.
