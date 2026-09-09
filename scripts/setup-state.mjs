// Only a native host's explicit response can identify an unconfigured installation.
export function needsWindowsSetup(value) {
  return value?.version === 1 && value?.platform === 'windows' && value?.configured === false;
}
