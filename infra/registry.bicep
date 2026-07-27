// Container registry, deployed on its own because the backend image has to exist
// before main.bicep can create a Container App that references it.
targetScope = 'resourceGroup'

@description('Location for the registry.')
param location string = resourceGroup().location

@description('Prefix used to derive resource names.')
param namePrefix string = 'gerifinancial'

var registryName = '${toLower(replace(namePrefix, '-', ''))}${uniqueString(resourceGroup().id)}'

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    // The Container App authenticates with a managed identity, so no admin password exists.
    adminUserEnabled: false
  }
}

output registryName string = registry.name
output loginServer string = registry.properties.loginServer
