export function isPreviewRequestAllowed(nodeEnvironment: string | undefined, enabledFlag: string | undefined): boolean {
  return nodeEnvironment !== 'production' && enabledFlag === '1';
}
