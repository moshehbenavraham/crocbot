# src/types/

Ambient TypeScript type definitions (`.d.ts` files) for untyped dependencies and global augmentations.

## Contents

Type declarations for:

- CLI libraries
- PTY (pseudo-terminal) bindings
- Canvas rendering
- Edge TTS
- LLM provider interfaces
- PDF processing libraries

## Purpose

These files make TypeScript aware of modules that don't ship their own type definitions, preventing `any` leakage and enabling type-safe usage throughout the codebase.
