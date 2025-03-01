import { Configuration } from "./configuration"

export type AssistantMessage = {
  type: 'webviewDidLaunch'
} | {
  type: 'configuration'
  configuration: Configuration
}
