This folder contains configuration files for the official deployment of OpenTogetherTube.

### Staging

```bash
fly deploy --config deploy/fly.staging.monolith.toml
```

### Production

```bash
fly deploy --config deploy/fly.production.monolith.toml
```

# Rollback

fly doesn't have a rollback command yet, so you have to do it manually.

Get a list of docker images:
```bash
fly app releases -a ott-prod
```

Rollback to a specific image:
```bash
fly deploy --config deploy/fly.prod.monolith.toml -i $DOCKER_IMAGE
```
