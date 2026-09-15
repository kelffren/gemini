# Guardian P2P Phase 3

Guardian P2P uses the existing `engine-net.js` WebSocket only for WebRTC signaling. Donor devices never receive gameplay, economy, identity, inventory, KC, or PvP authority.

## Signaling

- Authenticated Guardian node bind.
- Offer / answer / ICE routed only between session participants.
- 60-second signaling lease renewed from the existing Guardian donor heartbeat; no second keepalive timer.
- Maximum two signaling sessions per node.
- Rate limits and SDP / ICE size caps.
- Node must remain enabled in Guardian for every signal.
- Socket disconnect or donor disable revokes the binding/session.

## Peer channel

- WebRTC DataChannel: `kelo-guardian-relay-v1`.
- Latency probe/pong.
- Same-origin `/assets/` only.
- Asset must include expected SHA-256 and is verified before cache.
- Maximum 512 KiB per P2P asset in this phase.
- 18 KiB chunks for Safari/mobile compatibility.
- No `eval`, `new Function`, auth token, account state, economy, or PvP messages.

## NAT

Default mode uses STUN for direct connections. Production TURN can be injected through `KELO_GUARDIAN_ICE_SERVERS`; credentials are intentionally not committed to the repository.
