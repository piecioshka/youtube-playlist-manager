import { config } from 'zod';

// Zod przyspiesza parsowanie przez `new Function`, czego polityka CSP bez 'unsafe-eval' zabrania
config({ jitless: true });
