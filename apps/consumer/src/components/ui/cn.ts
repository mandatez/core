/**
 * Tiny class-name joiner. Filters falsy values and joins with a space.
 * No precedence resolution — variants in this library do not collide,
 * so a tailwind-merge dependency is intentionally avoided.
 */
export function cn(
  ...args: Array<string | false | null | undefined>
): string {
  return args.filter(Boolean).join(' ');
}
