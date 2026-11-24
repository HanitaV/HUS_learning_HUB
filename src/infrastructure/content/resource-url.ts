import type { Resource } from '../../domain/learning';

export function resolveResourceUrl(resource: Resource, baseUrl: string): string {
  const url = resource.url ?? `${baseUrl}${(resource.assetPath ?? '').split('/').map(encodeURIComponent).join('/')}`;
  return resource.kind === 'pdf' && resource.pages?.[0] ? `${url}#page=${resource.pages[0]}` : url;
}
