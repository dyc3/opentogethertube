# Configuring OpenTogetherTube

OTT is configured using `*.toml` files located in the `env/` directory.

First, a base configuration is loaded from `env/base.toml`. Then, based on the value of `env` (which can also be set using the `NODE_ENV` environment variable), a configuration file is loaded from `env/<env>.toml`. For example, if `env` is set to `production`, then `env/production.toml` will be loaded.

## All available options

The config schema is defined in [ott-config.ts](../server/ott-config.ts). Most config options are also overridable using environment variables, which are also included in the schema.
