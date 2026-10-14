import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Preserve the existing Next.js App Router, server endpoints and middleware.
// Configure R2-backed ISR only after a Cloudflare R2 bucket is provisioned.
export default defineCloudflareConfig();
