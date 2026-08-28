export function extractText(file: File): Promise<string> {
  if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.csv')) return file.text()
  return Promise.resolve('')
}

export function chunkDocument(text: string, size = 1200, overlap = 120) {
  const chunks: string[] = []
  for (let start = 0; start < text.length; start += Math.max(1, size - overlap)) chunks.push(text.slice(start, start + size))
  return chunks
}

export async function processDocument(file: File) {
  const text = await extractText(file)
  return { text, chunks: chunkDocument(text) }
}
