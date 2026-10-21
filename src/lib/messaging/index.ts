import { whatsappConfig } from "@/lib/env";
import { MetaCloudProvider } from "./meta/meta-provider";
import type { MessagingProvider } from "./provider";

export type { MessagingProvider } from "./provider";
export { ProviderError, isProviderError, friendlyError } from "./errors";

/**
 * Returns the configured provider. Only Meta exists today; switching a client to another
 * BSP later means adding a class here and setting MESSAGING_PROVIDER — nothing else changes.
 * Throws ConfigError when credentials are missing.
 */
export function getProvider(): MessagingProvider {
  const name = (process.env.MESSAGING_PROVIDER || "meta").toLowerCase();
  switch (name) {
    case "meta":
      return new MetaCloudProvider(whatsappConfig());
    default:
      throw new Error(`Unknown MESSAGING_PROVIDER "${name}"`);
  }
}
