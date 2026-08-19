export interface ServiceRegistration {
  id: string;
  version: string;
  name: string;
  description: string;
}

export interface AddonManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  author: string;
  icon?: string;
  license: string;
  entrypoint: string;
  services: ServiceRegistration[];
}