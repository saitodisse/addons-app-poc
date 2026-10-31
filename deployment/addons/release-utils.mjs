export function releaseInfo(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? '')) {
    throw new Error('Provide a stable release version in MAJOR.MINOR.PATCH format.');
  }
  const project = `addons-poc-release-${version.replaceAll('.', '-')}`;
  return { version, project, origin: `https://${project}.vercel.app` };
}
