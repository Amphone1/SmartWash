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

## Phase 6 (hardening)
- **ACLs**: `acl.conf` (this folder) — backend may `pub …/cmd` + `sub
  …/status|lwt`; devices may `pub …/status|lwt` + `sub …/cmd`; default deny.
  Enforce in prod by mounting it and enabling the file authz source:
  ```
  EMQX_AUTHORIZATION__NO_MATCH: deny
  EMQX_AUTHORIZATION__SOURCES: '[{type:"file",enable:true,path:"/opt/emqx/etc/acl.conf"}]'
  volumes: ["../mqtt/acl.conf:/opt/emqx/etc/acl.conf:ro"]
  ```
- **Authentication**: per-role (backend) and **per-device** credentials
  (clientid-scoped via `${clientid}` in the ACL). Dev runs anonymous so the
  Machine service + simulator connect without provisioning; do NOT enable strict
  ACL without authn or you will lock them out.
- **TLS**: EMQX `ssl` listener on `8883`; set `MQTT_URL=mqtts://emqx:8883` and
  mount broker certs. Dev stays on `1883`.
