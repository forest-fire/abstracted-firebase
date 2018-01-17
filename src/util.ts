export function slashNotation(path: string) {
  return path.substr(0, 5) === ".info"
    ? path.substr(0, 5) + path.substring(5).replace(/\./g, "/")
    : path.replace(/\./g, "/");
}
