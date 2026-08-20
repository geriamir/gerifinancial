export const formatAccountLabel = (
  name: string,
  loginHint?: string | null
): string => loginHint ? `${name} (${loginHint})` : name;
