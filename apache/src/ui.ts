export async function showConsentModal(params: {
  moduleId: string;
  capability: string;
  reason?: string;
}): Promise<boolean> {
  const msg = `Module "${params.moduleId}" requests "${params.capability}". ${
    params.reason ?? ''
  } Allow?`;
  return Promise.resolve(window.confirm(msg));
}
