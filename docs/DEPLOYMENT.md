# Deployment

How GeriFinancial is deployed to Azure, and how to redeploy it.

Everything lives in one resource group, `rg-gerifinancial`, in `northeurope`.

## What is deployed

| Component | Azure resource | Name |
| --- | --- | --- |
| API | Container App | `gerifinancial-api` |
| Redis | Container App | `gerifinancial-redis` |
| Web | Static Web App (Free) | `gerifinancial-web` |
| Database | Cosmos DB for MongoDB (vCore) | `gerifinancial-mongo-l2sld6nmx2xxq` |
| Images | Container Registry | `gerifinanciall2sld6nmx2xxq` |
| App secrets | Key Vault | `gfkvl2sld6nmx2xxq` |
| Encryption key | Key Vault | `gfkekl2sld6nmx2xxq` |

Public URLs:

- Web: <https://witty-glacier-04eac040f.7.azurestaticapps.net>
- API: <https://gerifinancial-api.livelymushroom-c563c2a6.northeurope.azurecontainerapps.io>

## Templates

Infrastructure is split into three Bicep files because of ordering constraints,
not for tidiness. Each must be deployed in this order the first time:

1. **`infra/registry.bicep`** — the container registry. It has to exist before an
   image can be built, and the image has to exist before the container app can
   reference it.
2. **`infra/vaults.bicep`** — both key vaults and the encryption key. Container
   Apps resolve Key Vault references *while a revision is being created*, so the
   vaults must exist and be populated before `main.bicep` runs, or the revision
   fails to start.
3. **`infra/main.bicep`** — everything else. It reads the vaults as `existing`.

After the first deployment, only steps 2 and 3 are re-run, and step 2 only when
vault configuration changes.

## Why there are two key vaults

A vault's soft-delete retention is fixed at creation and purge protection cannot
be turned off once enabled. Those are vault-wide settings, so a single vault
cannot be both durable and disposable. The two vaults have opposite requirements:

- **`gfkek…`** holds the RSA key that every user's data key is wrapped with.
  Losing it makes every stored bank credential permanently undecryptable, so it
  has 90-day retention, purge protection, and a `CanNotDelete` lock.
- **`gfkv…`** holds configuration secrets that can simply be regenerated. Losing
  it signs everyone out and nothing more, so it has 7-day retention and no purge
  protection, and a teardown followed by a redeploy is never blocked by a name
  stuck in the soft-deleted state.

The split also keeps the two roles apart. The API's managed identity holds
**Key Vault Crypto User** on the KEK vault and **Key Vault Secrets User** on the
app secrets vault, so no single assignment grants both.

> Do not delete or purge `gfkek…`. The lock makes this a two-step action
> deliberately.

## Secrets

Nothing is passed to the template as plaintext from a developer machine. Four
secrets live in `gfkvl2sld6nmx2xxq`:

| Secret | Used for | Safe to rotate freely? |
| --- | --- | --- |
| `jwt-secret` | signing session cookies and OAuth `state` | Yes — signs everyone out |
| `redis-password` | Redis AUTH | Yes — Redis has no persistence |
| `mongo-admin-password` | Mongo connection string | Only with the cluster |
| `github-oauth-client-secret` | GitHub OAuth App | Yes — rotate in GitHub first |

Three are consumed by the container app as Key Vault *references*, so their
values never enter the template, the deployment history, or a local file. Values
refresh roughly every 30 minutes, or immediately on a new revision.

`mongodb-uri` is the exception: it is a composed connection string, so
`mongoAdminPassword` is still a `@secure()` parameter. Fetch it from the vault at
deploy time rather than storing it anywhere (see the command below).

### Granting yourself access

Owner on the subscription does **not** grant data-plane access to an
RBAC-enabled vault. To read or write secrets, assign yourself once:

```bash
az role assignment create \
  --assignee "$(az ad signed-in-user show --query id -o tsv)" \
  --role "Key Vault Secrets Officer" \
  --scope "$(az keyvault show -n gfkvl2sld6nmx2xxq --query id -o tsv)"
```

Role assignments take 30 seconds to a couple of minutes to propagate.

### Rotating a secret

```bash
az keyvault secret set --vault-name gfkvl2sld6nmx2xxq --name jwt-secret \
  --value "$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")"
```

Then either wait for the ~30 minute refresh or force a new revision:

```bash
az containerapp revision restart -n gerifinancial-api -g rg-gerifinancial \
  --revision "$(az containerapp revision list -n gerifinancial-api -g rg-gerifinancial \
    --query "[?properties.active].name | [0]" -o tsv)"
```

Rotating `redis-password` requires redeploying `main.bicep` so that Redis and the
API pick up the new value together.

## GitHub OAuth

Sign-in uses a GitHub OAuth App. Production and local development need
**separate apps**, because an OAuth App allows only one callback URL.

Create it at <https://github.com/settings/developers>:

- Homepage: `https://witty-glacier-04eac040f.7.azurestaticapps.net`
- Callback: `https://gerifinancial-api.livelymushroom-c563c2a6.northeurope.azurecontainerapps.io/api/auth/github/callback`

The client ID is not a secret and is passed as a template parameter. Store the
client secret in the vault:

```bash
az keyvault secret set --vault-name gfkvl2sld6nmx2xxq \
  --name github-oauth-client-secret --value "<secret>"
```

Sign-in stays disabled if either value is missing, so deploying without them is
safe.

## Deploying

Pushes to `main` deploy themselves. `.github/workflows/deploy.yml` runs the unit
test suite, then rebuilds and releases whichever of the two apps changed, and
fails if the result is not actually being served. The sections below are the
manual fallback, for a first-time environment or a broken pipeline.

The workflow authenticates with a federated credential on the
`gerifinancial-deploy` user-assigned identity, so no Azure credential is stored
in GitHub. The identity is deliberately narrow - `AcrPush` on the registry and
Contributor on the two app resources only. It has no access to either vault, so
it cannot read application secrets.

Permission to mint that token is granted per job, not workflow-wide, and the
frontend is built in a separate job from the one that deploys it. The jobs that
run `npm ci` therefore cannot obtain Azure access: the deploy identity can
replace the running API container, and that container's own identity can unwrap
stored bank credentials, so a compromised build-time package would otherwise
have a path to them.

`infra/` is **not** deployed by CI. Bicep carries locks, role assignments and
vault wiring that should not roll out unreviewed, so a push touching `infra/`
only raises a warning in the run summary; deploy it by hand as below.

### Deploying the backend by hand

```bash
TAG="api-$(date +%Y%m%d-%H%M%S)"

az acr build -r gerifinanciall2sld6nmx2xxq -t "gerifinancial-api:$TAG" \
  -f backend/Dockerfile .

az deployment group create -g rg-gerifinancial -n main -f infra/main.bicep \
  --parameters \
    namePrefix=gerifinancial \
    location=northeurope \
    staticWebAppLocation=eastus2 \
    registryName=gerifinanciall2sld6nmx2xxq \
    containerImage="gerifinanciall2sld6nmx2xxq.azurecr.io/gerifinancial-api:$TAG" \
    mongoAdminUser=gerifinancial \
    mongoDatabaseName=gerifinancial \
    githubOAuthClientId=<client-id> \
    mongoAdminPassword="$(az keyvault secret show --vault-name gfkvl2sld6nmx2xxq \
      --name mongo-admin-password --query value -o tsv)"
```

The build runs in ACR, so Docker is not needed locally.

`containerImage` has no default, and CI moves the image on without touching the
template. When running Bicep for an unrelated infrastructure change, pass the
tag that is **currently live** or the deploy will quietly roll the API back:

```bash
az containerapp show -n gerifinancial-api -g rg-gerifinancial \
  --query "properties.template.containers[0].image" -o tsv
```

### Deploying the frontend by hand

The Static Web App is deployed with the SWA CLI. The API URL is baked in at
build time - a React build has no server side to read it from later:

```bash
cd frontend
REACT_APP_API_URL=https://gerifinancial-api.livelymushroom-c563c2a6.northeurope.azurecontainerapps.io \
  npm run build

npx swa deploy build --env production \
  --deployment-token "$(az staticwebapp secrets list -n gerifinancial-web \
    -g rg-gerifinancial --query properties.apiKey -o tsv)"
```

Confirm the site is serving the build you just made rather than a cached one -
deploying the API without the frontend once left production unable to sign in
at all, because the served bundle still asked for a password the API had
stopped accepting:

```bash
ls build/static/js/main.*.js                      # what you built
curl -s https://witty-glacier-04eac040f.7.azurestaticapps.net \
  | grep -o 'main\.[a-f0-9]*\.js'                 # what is served
```

## Verifying a deployment

```bash
# 1. The revision is running
az containerapp revision list -n gerifinancial-api -g rg-gerifinancial \
  --query "[?properties.active].{rev:name,healthy:properties.healthState}" -o table

# 2. Dependencies resolved, which proves the Key Vault references worked
curl https://gerifinancial-api.livelymushroom-c563c2a6.northeurope.azurecontainerapps.io/health
# {"status":"ok","mongo":"connected","redis":"connected"}

# 3. OAuth is configured — should 302 to github.com with the right client_id
curl -si https://gerifinancial-api.livelymushroom-c563c2a6.northeurope.azurecontainerapps.io/api/auth/github/login \
  | grep -i location
```

A failure to resolve a Key Vault reference shows up as a revision that never
becomes healthy. Check it with:

```bash
az containerapp logs show -n gerifinancial-api -g rg-gerifinancial --type system --tail 50
```

## Connecting to production MongoDB

The cluster firewall only allows Azure services. To inspect it from a laptop,
add a rule for your IP and remove it afterwards. The `az cosmosdb mongocluster`
commands need a preview extension and prompt for input, so use the REST API:

```bash
IP=$(curl -s https://api.ipify.org)
SUB=$(az account show --query id -o tsv)
URL="https://management.azure.com/subscriptions/$SUB/resourceGroups/rg-gerifinancial/providers/Microsoft.DocumentDB/mongoClusters/gerifinancial-mongo-l2sld6nmx2xxq/firewallRules/TempLocal?api-version=2024-07-01"

az rest --method put --url "$URL" \
  --body "{\"properties\":{\"startIpAddress\":\"$IP\",\"endIpAddress\":\"$IP\"}}"

# ... do the work ...

az rest --method delete --url "$URL"
```

Always remove the rule when finished, and confirm only `AllowAzureServices`
remains.
