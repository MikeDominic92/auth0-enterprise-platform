import { withMiddlewareAuthRequired } from '@auth0/nextjs-auth0/edge';

export default withMiddlewareAuthRequired();

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/users/:path*',
    '/teams/:path*',
    '/audit-logs/:path*',
    '/compliance/:path*',
    '/settings/:path*',
  ],
};
