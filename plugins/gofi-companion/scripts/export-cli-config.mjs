#!/usr/bin/env node
// Generate an actual UTCP CLI discovery template for this installed location.
// The config contains executable paths, never credentials.
import { discovery } from '../runtime/provider.mjs';
console.log(JSON.stringify({ manual_call_templates: [discovery] }, null, 2));
