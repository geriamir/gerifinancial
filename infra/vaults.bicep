// Key vaults, deployed ahead of main.bicep.
//
// These are separate from the runtime stack for the same reason registry.bicep
// is: the container apps read their secrets out of the app secrets vault while
// the revision is being created, so the vault has to exist and be seeded before
// main.bicep runs. Creating both in one template would be circular.
//
// Deploy order for a new environment:
//   1. registry.bicep   - container registry
//   2. vaults.bicep     - this file
//   3. seed the app secrets vault (see docs/DEPLOYMENT.md)
//   4. build and push the API image
//   5. main.bicep       - everything else
targetScope = 'resourceGroup'

@description('Location for the vaults.')
param location string = resourceGroup().location

var suffix = uniqueString(resourceGroup().id)

// Vault names are globally unique and capped at 24 characters, so the full
// prefix does not fit.
//
// Two vaults, because a vault's soft-delete retention is fixed at creation and
// purge protection cannot be switched off once enabled, so a single vault
// cannot be both durable and disposable:
//
//  - the KEK vault holds the one key whose loss is unrecoverable. Purging it
//    would leave every user's stored bank credentials permanently undecryptable,
//    so it is protected against deletion and never torn down.
//  - the app secrets vault holds values that can simply be regenerated. Losing
//    it signs everyone out and nothing more, so it stays cheap to recreate.
//
// Splitting them also keeps the roles apart: the app can unwrap credentials in
// one vault and read configuration from the other, but no single assignment
// grants both.
var keyVaultName = 'gfkv${suffix}'
var kekVaultName = 'gfkek${suffix}'
var credentialKekName = 'credential-kek'

// Holds configuration secrets only: nothing here protects user data, so the
// short retention and absent purge protection are deliberate. A teardown
// followed by a redeploy must not be blocked by a name still held in the
// deleted state, and everything inside can be regenerated.
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    // Access is granted through Azure RBAC rather than legacy access policies.
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

// Holds the key-encryption key that every user's data key is wrapped with.
// Purging this vault destroys every stored bank credential irreversibly, so it
// is configured to resist exactly that: the maximum recovery window, purge
// protection that cannot be switched off again, and a delete lock on top.
resource kekVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kekVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      // Software-protected keys. A Premium SKU would allow HSM-backed keys at
      // $1/key/month, which is not worth it at this scale.
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    // Both of these are one-way: retention cannot be changed after creation and
    // purge protection cannot be disabled. That is the point.
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

// Deleting the vault would start a 90 day countdown that no redeploy can undo,
// so the lock makes it a two-step decision rather than a one-line mistake.
resource kekVaultLock 'Microsoft.Authorization/locks@2020-05-01' = {
  scope: kekVault
  name: 'kek-vault-no-delete'
  properties: {
    level: 'CanNotDelete'
    notes: 'Purging this vault permanently destroys every stored bank credential.'
  }
}

// Key Vault outside a Managed HSM cannot hold AES keys, so the KEK is RSA and
// data keys are wrapped with RSA-OAEP-256.
resource credentialKek 'Microsoft.KeyVault/vaults/keys@2023-07-01' = {
  parent: kekVault
  name: credentialKekName
  properties: {
    kty: 'RSA'
    keySize: 2048
    keyOps: [
      'wrapKey'
      'unwrapKey'
    ]
  }
}

@description('Vault holding regenerable configuration secrets. Seed this before deploying main.bicep.')
output appSecretsVaultName string = keyVault.name
output appSecretsVaultUrl string = keyVault.properties.vaultUri

@description('Vault holding the credential key-encryption key. Purge protected and delete locked.')
output kekVaultName string = kekVault.name
output kekVaultUrl string = kekVault.properties.vaultUri
output credentialKekName string = credentialKek.name
