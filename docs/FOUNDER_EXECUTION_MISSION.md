# KELO WORLD — Founder Execution Mission

> **Persistent project memory.** This document preserves how Kelo wants ambitious product ideas handled by humans and AI working on this repository. It is direction, not permission to bypass security, physics, platform limits or repository ownership rules.

## Core mission

When the founder proposes an idea, the engineering mission is:

> **Buscar activamente la forma técnica de hacer la idea realidad.**

Do not stop at the first limitation, current vendor dependency or conventional implementation. Investigate the actual constraint, find architectures used elsewhere, map them onto KELO WORLD's owners, build the smallest real path, test it, and keep iterating until the remaining blocker is concrete.

The correct response to an ambitious idea is not automatically:

```text
"No se puede."
```

It is:

```text
¿Qué parte exacta lo impide hoy?
¿Qué arquitectura elimina esa dependencia?
¿Qué parte podemos ejecutar ahora?
¿Qué evidencia demuestra que funciona?
¿Qué límite físico/plataforma todavía queda?
```

## Honesty rule

Making ideas real does **not** mean pretending unfinished work is finished.

Always distinguish:

- implemented and tested;
- implemented but not LIVE-validated;
- foundation/prepared;
- future work;
- physically/platform impossible under current constraints.

If the exact idea cannot be implemented safely, preserve the founder's intent and find the closest architecture that actually achieves the underlying goal. Do not silently replace it with a weaker idea and call it complete.

## Architecture rule

Ambition does not override Foundation.

Use existing owners and contracts. If a capability is missing, extract or extend the correct owner instead of creating a duplicate engine.

For large ideas prefer:

```text
IDEA
  ↓
identify invariant / desired experience
  ↓
inspect current owners
  ↓
remove the real technical bottleneck
  ↓
build reusable capability
  ↓
test deterministically
  ↓
LIVE/mobile validation
```

## Guardian Network — founder objective

Guardian is the canonical example of this mission.

The founder does **not** merely want a decorative “server” button. The target experience is:

```text
[ ENCENDER HOST ALTRUISTA ]
          ↓
my device contributes real compute/network capacity
          ↓
KELO assigns useful work
          ↓
players use that capacity
          ↓
another Guardian is already ready if I disappear
          ↓
useful verified contribution earns Guardian rewards
```

### Render dependency target

Current vendor dependency is not a permanent product requirement.

The target architecture is:

```text
GitHub Pages / installed client
            │
            ├── Supabase: identity, lease, durable truth, economy
            │
            └── Guardian Network: realtime simulation / relay / mirrors / assets
```

Render/Node may remain as a fallback or compatibility host, but KELO WORLD should not require one Render process to keep realtime gameplay alive.

### One-button end state

For an eligible donor:

```text
ENCENDER HOST
→ Guardian registration
→ capability measurement
→ lease/work assignment
→ portable simulation worker starts
→ WebRTC clients attach
→ mirrors receive authority state
→ verified useful-service accounting begins
```

For ordinary players:

```text
PLAY
→ transparent P2P client participation
→ connect to best assigned Guardian
```

Ordinary participation must not opt a player into donating resources. **Client connectivity and altruistic donation are separate permissions.**

### Failover end state

A Primary failure should not mean “start a new game”.

Target:

```text
PRIMARY
   │ continuous authority state
   ▼
HOT MIRROR
   │
PRIMARY lost
   ↓
lease/epoch advances
   ↓
mirror imports exact transient state
   ↓
continues simulation
```

Use witness/quorum/lease rules to prevent split-brain.

### Regional end state

Guardians should be assigned from measured network performance, not merely profile country.

European players should be able to receive European realtime authority when European Guardians provide the best RTT/capacity. USA Guardians can host USA workloads. Relays help routing/NAT, but the largest latency improvement comes from moving the relevant realtime authority closer to the players.

### Altruism/reward end state

Do not pay primarily for a button being ON.

Reward **verified useful service**:

- active host seconds;
- hot-mirror readiness;
- acknowledged relay traffic;
- validated asset delivery;
- validated compute;
- successful failover rescue;
- a small capped availability component.

Ranks can multiply legitimate verified contribution, including the founder's desired ×2 and ×3 tiers. The player device never mints its own KC.

## Product philosophy

A recurring KELO WORLD design principle is:

> **More community should be able to create more capacity, not only more server cost.**

Guardian exists to make that principle technically real while preserving account/economy security.

## Agent/human handoff rule

Before ending a pass on an unfinished founder idea, record:

1. what is now real;
2. exact remaining blocker;
3. next owner/file to change;
4. test that will prove the next step;
5. any safety/platform limit that cannot be engineered away.

This prevents future agents from restarting the research, watering down the goal, or mistaking a foundation for completion.
