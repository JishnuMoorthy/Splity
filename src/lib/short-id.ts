import { customAlphabet } from "nanoid";

// Avoid ambiguous chars: 0/O, 1/l/i (CLAUDE.md §5)
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const generateShortId = customAlphabet(ALPHABET, 6);
