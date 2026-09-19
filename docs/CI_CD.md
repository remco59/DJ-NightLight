# CI/CD

## Pull-request checks

Every pull request runs:

1. dependency installation;
2. ESLint;
3. Nuxt type checking;
4. unit tests;
5. production Nuxt build;
6. production Docker image build.

Do not merge a feature PR while these checks are failing.

## Staging deployment

The `Deploy staging` workflow is manual for now. It connects to Unraid over SSH, fast-forwards the server checkout to `origin/main`, and rebuilds the staging Compose stack.

Create a GitHub environment named `staging` and configure:

- `STAGING_SSH_KEY`
- `STAGING_KNOWN_HOSTS`
- `STAGING_HOST`
- `STAGING_USER`
- `STAGING_PORT`
- `STAGING_DEPLOY_PATH`
- `STAGING_ENV_FILE`

The environment file itself stays on Unraid and is never copied into GitHub.

## Production deployment

The `Deploy production` workflow is deliberately `workflow_dispatch` only.

Create a GitHub environment named `production` and enable required reviewers/approval in GitHub when available. Configure the equivalent `PRODUCTION_*` secrets.

Production should be deployed only after the same commit has been verified on staging.

## Host-key verification

Store the exact SSH known-hosts line in `*_KNOWN_HOSTS`. Do not disable strict host-key verification with `StrictHostKeyChecking=no`.

## Initial server checkout

The deploy workflows expect `*_DEPLOY_PATH` to already contain a clone of this repository and the private environment file referenced by `*_ENV_FILE`.

The initial clone remains a one-time server setup task.
