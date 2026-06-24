import type { z } from 'zod';
import type { addDocumentSchema, searchQuerySchema } from '../validation/knowledge-schemas.js';

export type AddDocumentInput = z.input<typeof addDocumentSchema>;
export type SearchQueryInput = z.input<typeof searchQuerySchema>;
