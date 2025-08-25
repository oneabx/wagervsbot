export function isCommand(text: string): boolean {
  return Boolean(text && text.startsWith("/"));
}
