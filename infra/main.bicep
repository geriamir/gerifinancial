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

@description('Administrator password for the Mongo cluster.')
@secure()
param mongoAdminPassword string

@description('Secret used to sign JWTs.')
@secure()
param jwtSecret string

@description('Key used to encrypt stored bank credentials. AES-256 needs exactly 32 bytes and the app passes this straight to Buffer.from(), so the length is fixed. Changing it makes existing credentials unreadable.')
@minLength(32)
@maxLength(32)
@secure()
param encryptionKey string

@description('Password for the Redis container.')
@secure()
param redisPassword string

@description('Mongo database name.')
param mongoDatabaseName string = 'gerifinancial'

var suffix = uniqueString(resourceGroup().id)
var mongoClusterName = '${namePrefix}-mongo-${suffix}'
var containerAppName = '${namePrefix}-api'
var redisAppName = '${namePrefix}-redis'

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
          name: 'redis-password'
          value: redisPassword
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
              secretRef: 'redis-password'
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
          name: 'mongodb-uri'
          // Built from the @secure() mongoAdminPassword; the linter cannot see through the interpolation.
          #disable-next-line use-secure-value-for-secure-inputs
          value: mongoConnectionString
        }
        {
          name: 'redis-password'
          value: redisPassword
        }
        {
          name: 'jwt-secret'
          value: jwtSecret
        }
        {
          name: 'encryption-key'
          value: encryptionKey
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
              secretRef: 'mongodb-uri'
            }
            {
              name: 'JWT_SECRET'
              secretRef: 'jwt-secret'
            }
            {
              name: 'ENCRYPTION_KEY'
              secretRef: 'encryption-key'
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
              secretRef: 'redis-password'
            }
            {
              name: 'CORS_ORIGIN'
              value: 'https://${staticWebApp.properties.defaultHostname}'
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
