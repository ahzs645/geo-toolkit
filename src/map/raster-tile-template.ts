// ArcGIS and WMTS use row for the north-origin Y and column for X.
const placeholders: Record<string, string> = {
  tilematrix: '{z}',
  level: '{z}',
  tilerow: '{y}',
  row: '{y}',
  tilecol: '{x}',
  col: '{x}',
}

/** Adapt a numeric Web Mercator WMTS or ArcGIS tile template for a MapLibre raster source. */
export function xyzTileTemplate(template: string): string {
  const xyz = template.replace(/\{(tilematrix|level|tilerow|row|tilecol|col)\}/gi, (_, name: string) => {
    return placeholders[name.toLowerCase()]
  })
  if (!['{z}', '{x}', '{y}'].every((token) => xyz.includes(token))) {
    throw new Error('The tile template needs placeholders for zoom, column and row.')
  }
  return xyz
}
