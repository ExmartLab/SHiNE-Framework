import LocalFileResolver from "./localFileResolver"
import RemoteResolver from "./remoteResolver"

type Params = {
  basePath?: string
  jsonPointer?: string
  remote?: boolean
}

export default function generateResolverOptions(params: Params) {
  const { basePath, jsonPointer, remote } = params

  let config = {}

  if (basePath) {
    config["resolvers"] = {
      file: LocalFileResolver(basePath),
    }
  }

  if (remote) {
    if (config["resolvers"] === undefined) {
      config["resolvers"] = {}
    }
    config["resolvers"]["http"] = RemoteResolver("http")
    config["resolvers"]["https"] = RemoteResolver("https")
  }

  if (jsonPointer) {
    config["jsonPointer"] = jsonPointer
  }

  return config
}