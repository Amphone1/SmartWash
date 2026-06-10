# EMQX (MQTT) — dev notes

WISE-4051 topic plan (per `contracts/mqtt/mqtt.schema.json`):

```
smartwash/{branch}/{machine}/cmd      # downlink START/STOP/PAUSE/RESUME (QoS 2)
smartwash/{branch}/{machine}/status   # uplink telemetry              (QoS 1)
smartwash/{branch}/{machine}/lwt      # Last Will → OFFLINE detection (QoS 1, retained)
```

## Phase 3 (dev)
The dev EMQX runs with default (anonymous) access so the Machine service
(`MQTT_USERNAME=backend`) and the device simulator (`MQTT_USERNAME=device`) can
connect without provisioning. The Machine service subscribes to
`smartwash/+/+/status` and `smartwash/+/+/lwt` and publishes commands to
`…/cmd`.

## Phase 6 (hardening — TODO)
- Per-role MQTT **authentication** (backend vs device credentials).
- **ACLs**: devices may only publish their own `status`/`lwt` and subscribe their
  own `cmd`; the backend may publish `cmd` and subscribe `status`/`lwt`.
- **TLS** for broker connections.
