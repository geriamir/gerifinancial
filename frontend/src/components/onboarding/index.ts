// Onboarding is a scripted conversation. There is no wizard behind it any more:
// the server owns the state machine, and this renders it as chat.
export { OnboardingChat } from './chat';
export { buildScript } from './chat';
export type { ChatMessage, CardId, Script, ChatHandlers, CardProps } from './chat';
