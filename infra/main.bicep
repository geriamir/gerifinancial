// gerifinancial runtime stack: Container App backend, Cosmos DB for MongoDB (vCore),
// Redis as an internal Container App (rationale at the redisApp resource below) and a
// Static Web App for the React frontend.
targetScope = 'resourceGroup'

@description('Location for all resources except the Static Web App.')
param location string = resourceGroup().location

@description('Static Web Apps free tier is offered in a handful of regions only; westeurope is currently closed to new customers. The region is metadata - content is served from a global CDN.')
param staticWebAppLocation string = 'eastus2'

@description('Prefix used to derive resource names.')
param namePrefix string = 'gerifinancial'

@description('Name of the existing container registry created by registry.bicep.')
param registryName string

@description('Fully qualified backend image reference, e.g. myacr.azurecr.io/gerifinancial-backend:v1.')
param containerImage string

@description('Administrator user for the Mongo cluster.')
param mongoAdminUser string = 'gerifinancial'

@description('Administrator password for the Mongo cluster. Needed at deploy time to provision the cluster, so it stays a parameter rather than a vault reference; keep the master copy in the app secrets vault and pass it in from there.')
@secure()
param mongoAdminPassword string

@description('Client ID of the GitHub OAuth App used for sign-in. Not a secret, unlike the client secret, which is read from the app secrets vault. Leave empty to deploy with sign-in disabled.')
param githubOAuthClientId string = ''

@description('Mongo database name.')
param mongoDatabaseName string = 'gerifinancial'

@description('''Region for the Azure OpenAI account. Deliberately not the resource group's region: North Europe carries a reduced model catalogue and offers no chat model on a pay-as-you-go SKU (gpt-5 and gpt-5-mini are provisioned-capacity only there, and the gpt-5.4 family has no quota), so an account created there cannot serve chat at all. Sweden Central is the nearest EU region with the full catalogue. Verify with: az cognitiveservices model list --location <region>.''')
param openAiLocation string = 'swedencentral'

@description('Tokens-per-minute quota, in thousands, for each model deployment. Quota for Global* SKUs is a subscription-wide pool shared with every other account in the subscription, so these stay modest rather than claiming the whole allowance.')
param openAiChatCapacity int = 100

@description('Tokens-per-minute quota, in thousands, for the embedding deployment.')
param openAiEmbeddingCapacity int = 100

@description('''Billing and routing model for the chat deployment. GlobalStandard is pay-as-you-go and may serve a request from capacity outside the EU. DataZoneStandard keeps inference within the EU data zone and is the better fit for financial data, but currently has zero quota in every EU region and needs a quota increase before it can be selected. Nothing in the application depends on this, so it can be switched once quota exists.''')
@allowed([
  'GlobalStandard'
  'DataZoneStandard'
])
param openAiChatSku string = 'GlobalStandard'

var suffix = uniqueString(resourceGroup().id)
var mongoClusterName = '${namePrefix}-mongo-${suffix}'
var containerAppName = '${namePrefix}-api'
var redisAppName = '${namePrefix}-redis'
// Must match the names vaults.bicep derives from the same resource group.
var keyVaultName = 'gfkv${suffix}'
var kekVaultName = 'gfkek${suffix}'
var credentialKekName = 'credential-kek'

// Globally unique and capped at 24 characters, like the vault names.
var openAiName = 'gfoai${suffix}'
var openAiChatDeploymentName = 'gpt-5-mini'
var openAiEmbeddingDeploymentName = 'text-embedding-3-small'

var mongoUriSecretName = 'mongodb-uri'
var jwtSecretName = 'jwt-secret'
var redisPasswordSecretName = 'redis-password'
var githubOAuthSecretName = 'github-oauth-client-secret'

// The OAuth callback URL has to be registered with GitHub ahead of time, so it
// cannot be read back off the container app - that would be circular. The
// environment's domain is enough to derive it.
var apiPublicUrl = 'https://${containerAppName}.${containerEnv.properties.defaultDomain}'

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: registryName
}

// A user-assigned identity is used rather than a system-assigned one: the role
// assignment that lets the app pull from the registry must exist before the
// Container App is created, which is impossible if the identity is created with it.
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-identity'
  location: location
}

// Redis gets its own identity rather than borrowing the API's. Sharing it would
// hand the Redis container a token that can wrap and unwrap the credential KEK,
// which it has no reason to touch, and would undo the role separation the two
// vaults exist to enforce.
resource redisIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-redis-identity'
  location: location
}

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: registry
  name: guid(registry.id, identity.id, acrPullRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Both vaults are created by vaults.bicep, which must be deployed - and the app
// secrets vault seeded - before this template runs. See that file for why they
// are separate and why they cannot be created here.
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource kekVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: kekVaultName
}

resource credentialKek 'Microsoft.KeyVault/vaults/keys@2023-07-01' existing = {
  parent: kekVault
  name: credentialKekName
}

// Key Vault Crypto User: wrap and unwrap only. The app cannot read, export,
// modify or delete the key itself. Scoped to the KEK vault alone, so it conveys
// nothing about the configuration secrets next door.
var keyVaultCryptoUserRoleId = '12338af0-0e69-4776-bea7-57ae8d297424'

resource keyVaultCryptoUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: kekVault
  name: guid(kekVault.id, identity.id, keyVaultCryptoUserRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultCryptoUserRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Key Vault Secrets User: read secret values, nothing else. Scoped to the app
// secrets vault, so it grants no access to the KEK.
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource keyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, identity.id, keyVaultSecretsUserRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Redis needs exactly one secret, so its grant is scoped to that secret rather
// than to the vault. The API is left at vault scope because it legitimately
// reads almost everything in there.
resource redisPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = {
  parent: keyVault
  name: redisPasswordSecretName
}

resource redisSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: redisPasswordSecret
  name: guid(redisPasswordSecret.id, redisIdentity.id, keyVaultSecretsUserRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: redisIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Azure OpenAI. Note the region: this account is deliberately not in the
// resource group's region - see the openAiLocation parameter for why North
// Europe cannot serve chat at all. The extra hop between the container app and
// Sweden Central stays inside the EU and costs a few milliseconds.
//
// Authentication is Entra ID only. disableLocalAuth switches off the account
// keys entirely, so there is no key to leak, rotate or store in a vault - the
// container app's managed identity is the only way in, exactly as it is for
// Mongo, Redis and both vaults.
resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: openAiName
  location: openAiLocation
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    // Required for Entra ID auth: tokens are issued against the custom subdomain
    // rather than the shared regional endpoint.
    customSubDomainName: openAiName
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

// GlobalStandard is pay-as-you-go with no reserved capacity. It does mean
// inference may be served from any Azure region worldwide; DataZoneStandard
// would confine it to the EU, and is the better fit for transaction data, but
// it currently carries no quota in any EU region on this subscription. Moving
// over is a SKU change here plus nothing in the application, because the
// deployment name stays the same.
resource chatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: openAiChatDeploymentName
  sku: {
    name: openAiChatSku
    capacity: openAiChatCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-5-mini'
      version: '2025-08-07'
    }
  }
}

// text-embedding-3-small rather than -large: -large has no quota left anywhere
// on this subscription, and -small is a fifth of the price at half the vector
// width (1536 dimensions), which also halves what has to be stored per
// transaction. Ample for scoring merchant descriptions against each other.
resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: openAiEmbeddingDeploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: openAiEmbeddingCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-3-small'
      version: '1'
    }
  }
  // Deployments on one account must be created one at a time; issuing them in
  // parallel fails with a conflict on the parent account.
  dependsOn: [
    chatDeployment
  ]
}

// Cognitive Services OpenAI User: call the inference endpoints, nothing else.
// It conveys no ability to create or alter deployments, and - unlike the
// Contributor roles - no ability to read the account keys, which is what keeps
// disableLocalAuth from being merely decorative.
var openAiUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

resource openAiUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: openAi
  name: guid(openAi.id, identity.id, openAiUserRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', openAiUserRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource mongoCluster 'Microsoft.DocumentDB/mongoClusters@2024-07-01' = {
  name: mongoClusterName
  location: location
  properties: {
    administrator: {
      userName: mongoAdminUser
      password: mongoAdminPassword
    }
    serverVersion: '7.0'
    compute: {
      tier: 'Free'
    }
    storage: {
      sizeGb: 32
    }
    sharding: {
      shardCount: 1
    }
    highAvailability: {
      targetMode: 'Disabled'
    }
  }
}

// Container Apps egress uses a pool of Azure addresses rather than one stable IP,
// so the cluster is opened to Azure services (the 0.0.0.0-0.0.0.0 sentinel range)
// instead of a specific address. Access still requires the SCRAM credentials.
resource mongoFirewall 'Microsoft.DocumentDB/mongoClusters/firewallRules@2024-07-01' = {
  parent: mongoCluster
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Redis runs as a container inside the Container Apps environment rather than as a
// managed service, for two reasons:
//
//  1. Azure Cache for Redis is retired for new instances, and Azure Managed Redis
//     (Microsoft.Cache/redisEnterprise) cannot be created on this Visual Studio
//     Enterprise subscription - a Balanced_B0 create is accepted and then fails
//     asynchronously with an opaque CreateFailed and no error detail. Retested
//     2026-07-31 in North Europe; previously also reproduced in Sweden Central.
//  2. Cost. Measured actuals: this container is ~$2.70/month, against ~$14.60/month
//     for a Balanced_B0 - roughly two thirds of the entire stack's ~$18/month bill.
//
// Ingress is internal, so it is never reachable from the internet.
//
// There is no persistence: BullMQ jobs and distributed locks are both recoverable
// (a lost scrape can simply be retriggered), so an empty cache after a restart is safe.
// Switching to a managed Redis later is a contained change: swap this resource and
// repoint REDIS_HOST/REDIS_PORT/REDIS_PASSWORD plus REDIS_TLS on the backend.
resource redisApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: redisAppName
  location: location
  // Needed only so the platform can resolve the password out of the vault.
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${redisIdentity.id}': {}
    }
  }
  dependsOn: [
    redisSecretsUser
  ]
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: false
        transport: 'tcp'
        targetPort: 6379
        exposedPort: 6379
      }
      secrets: [
        {
          name: redisPasswordSecretName
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/${redisPasswordSecretName}'
          identity: redisIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'redis'
          image: 'redis:7.4-alpine'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'REDIS_PASSWORD'
              secretRef: redisPasswordSecretName
            }
          ]
          // Run through a shell so the password comes from the environment rather than
          // being baked into the template arguments. exec keeps redis as PID 1 so it
          // still receives shutdown signals.
          command: [
            'sh'
            '-c'
          ]
          args: [
            'exec redis-server --requirepass "$REDIS_PASSWORD" --maxmemory-policy noeviction --appendonly no'
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${namePrefix}-web'
  location: staticWebAppLocation
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // The frontend is uploaded with the SWA CLI, so no repository is linked here.
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// retrywrites=false is required: Cosmos DB for MongoDB vCore rejects the retryable
// writes that the Node driver enables by default.
var mongoConnectionString = 'mongodb+srv://${mongoAdminUser}:${uriComponent(mongoAdminPassword)}@${mongoCluster.name}.global.mongocluster.cosmos.azure.com/${mongoDatabaseName}?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000'

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  dependsOn: [
    acrPull
    redisApp
    // The app resolves the key on first use, but the role assignment and the
    // key itself must exist before it starts serving traffic. The secrets role
    // is stricter still: the platform resolves the vault references while the
    // revision is being created, so it has to be in place first.
    keyVaultCryptoUser
    keyVaultSecretsUser
    credentialKek
    // The app resolves its Azure OpenAI token lazily, but the role assignment
    // and both deployments should exist before it serves traffic so the first
    // request does not fail against a half-built account.
    openAiUser
    embeddingDeployment
  ]
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3001
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: identity.id
        }
      ]
      secrets: [
        {
          // Derived rather than stored: the administrator password is already in
          // the vault, and composing the URI here stops the two from drifting.
          name: mongoUriSecretName
          // Built from the @secure() mongoAdminPassword; the linter cannot see through the interpolation.
          #disable-next-line use-secure-value-for-secure-inputs
          value: mongoConnectionString
        }
        {
          name: redisPasswordSecretName
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/${redisPasswordSecretName}'
          identity: identity.id
        }
        {
          name: jwtSecretName
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/${jwtSecretName}'
          identity: identity.id
        }
        {
          name: githubOAuthSecretName
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/${githubOAuthSecretName}'
          identity: identity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: containerImage
          resources: {
            // Chrome is memory hungry; anything smaller risks the renderer being killed mid-scrape.
            cpu: json('1.0')
            memory: '2Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3001'
            }
            {
              name: 'MONGODB_URI'
              secretRef: mongoUriSecretName
            }
            {
              name: 'JWT_SECRET'
              secretRef: jwtSecretName
            }
            {
              name: 'AZURE_KEY_VAULT_URL'
              value: kekVault.properties.vaultUri
            }
            {
              name: 'AZURE_KEY_VAULT_KEY_NAME'
              value: credentialKekName
            }
            {
              // DefaultAzureCredential needs to be told which user-assigned
              // identity to request a token for.
              name: 'AZURE_CLIENT_ID'
              value: identity.properties.clientId
            }
            {
              name: 'REDIS_HOST'
              // TCP ingress is reached by app name. The ".internal.<env>" FQDN only
              // serves HTTP ingress and silently hangs on a TCP connect.
              value: redisAppName
            }
            {
              name: 'REDIS_PORT'
              value: '6379'
            }
            {
              name: 'REDIS_PASSWORD'
              secretRef: redisPasswordSecretName
            }
            {
              name: 'CORS_ORIGIN'
              value: 'https://${staticWebApp.properties.defaultHostname}'
            }
            {
              name: 'GITHUB_OAUTH_CLIENT_ID'
              value: githubOAuthClientId
            }
            {
              name: 'GITHUB_OAUTH_CLIENT_SECRET'
              secretRef: githubOAuthSecretName
            }
            {
              // Used to build the OAuth callback URL, which must match the one
              // registered on the GitHub OAuth App exactly.
              name: 'PUBLIC_API_URL'
              value: apiPublicUrl
            }
            {
              name: 'DEFAULT_RETURN_TO'
              value: 'https://${staticWebApp.properties.defaultHostname}'
            }
            {
              // No key: the app authenticates with the same managed identity it
              // uses for the vaults, via AZURE_CLIENT_ID above.
              name: 'AZURE_OPENAI_ENDPOINT'
              value: openAi.properties.endpoint
            }
            {
              // Deployment names, not model names. Pinning the model version is
              // a property of the deployment, so swapping models is a change
              // here and in Bicep rather than in application code.
              name: 'AZURE_OPENAI_CHAT_DEPLOYMENT'
              value: openAiChatDeploymentName
            }
            {
              name: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT'
              value: openAiEmbeddingDeploymentName
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 3001
              }
              initialDelaySeconds: 30
              periodSeconds: 30
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 3001
              }
              initialDelaySeconds: 10
              periodSeconds: 10
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        // Pinned to a single replica: the process also runs the BullMQ scraping worker
        // and holds in-memory SSE subscriptions, neither of which benefits from scale-out.
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

output backendFqdn string = containerApp.properties.configuration.ingress.fqdn
output backendUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output mongoClusterName string = mongoCluster.name
output redisHostName string = redisAppName
@description('Vault holding regenerable configuration secrets. Seed this before deploying: the platform resolves the references while the revision is created.')
output appSecretsVaultName string = keyVault.name
output appSecretsVaultUrl string = keyVault.properties.vaultUri

@description('Vault holding the credential key-encryption key. Purge protected and delete locked; never tear this down while any user has stored bank credentials.')
output kekVaultName string = kekVault.name
output kekVaultUrl string = kekVault.properties.vaultUri

@description('Azure OpenAI account. Entra ID only - it has no keys to retrieve, so nothing here needs to reach a vault.')
output openAiName string = openAi.name
output openAiEndpoint string = openAi.properties.endpoint
output openAiLocationUsed string = openAiLocation
output openAiChatDeployment string = openAiChatDeploymentName
output openAiEmbeddingDeployment string = openAiEmbeddingDeploymentName

@description('Register this exact URL as the Authorization callback URL on the GitHub OAuth App.')
output githubOAuthCallbackUrl string = '${apiPublicUrl}/api/auth/github/callback'
