import { describe, it, expect } from 'vitest';
import { toExternalUrl } from '@/lib/portal/url';

describe('toExternalUrl', () => {
  it('null → null', () => {
    expect(toExternalUrl(null)).toBeNull();
  });

  it('undefined → null', () => {
    expect(toExternalUrl(undefined)).toBeNull();
  });

  it('cadena vacía → null', () => {
    expect(toExternalUrl('')).toBeNull();
  });

  it('solo espacios → null', () => {
    expect(toExternalUrl('   ')).toBeNull();
  });

  it('https:// ya presente → sin cambios', () => {
    expect(toExternalUrl('https://example.com')).toBe('https://example.com');
  });

  it('http:// ya presente → sin cambios', () => {
    expect(toExternalUrl('http://example.com')).toBe('http://example.com');
  });

  it('dominio sin protocolo → añade https://', () => {
    expect(toExternalUrl('example.com')).toBe('https://example.com');
  });

  it('www sin protocolo con espacios → trim + añade https://', () => {
    expect(toExternalUrl(' www.example.com ')).toBe('https://www.example.com');
  });

  it('subdominio sin protocolo → añade https://', () => {
    expect(toExternalUrl('preview.example.com')).toBe('https://preview.example.com');
  });

});
