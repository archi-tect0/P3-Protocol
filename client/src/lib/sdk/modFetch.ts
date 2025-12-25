import { P3 } from './index';
import { Roles } from './roles';

export async function modFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  
  try {
    const addr = await P3.session.address();
    
    if (addr) {
      headers.set('X-P3-Addr', addr);
      
      const isMod = await Roles.isModerator(addr);
      headers.set('X-P3-Role', isMod ? 'moderator' : 'user');
    }
  } catch {
  }
  
  return fetch(input, {
    ...init,
    headers
  });
}
