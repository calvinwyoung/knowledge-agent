import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import Langfuse from 'langfuse';

let sdk: NodeSDK | null = null;
let langfuseClient: Langfuse | null = null;

/**
 * Return the Langfuse client instance, or null if tracing is disabled.
 */
export function getLangfuseClient(): Langfuse | null {
  return langfuseClient;
}

/**
 * Initialize OpenTelemetry with a Langfuse span processor for trace collection. Tracing
 * is opt-in: the app works without Langfuse credentials, so we return early if they're
 * absent.
 */
export function initTracing(): void {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return;
  }

  const spanProcessor = new LangfuseSpanProcessor({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
  });

  sdk = new NodeSDK({ spanProcessors: [spanProcessor] });
  sdk.start();

  langfuseClient = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
  });
}

/**
 * Flush any buffered spans to Langfuse before the process exits.
 */
export async function shutdownTracing(): Promise<void> {
  if (langfuseClient) {
    await langfuseClient.shutdownAsync();
  }
  if (sdk) {
    await sdk.shutdown();
  }
}
