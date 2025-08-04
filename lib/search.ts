import { db } from './db'

export async function keywordSearch(q: string, limit = 20) {
  const like = `%${q}%`
  return db.article.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { summaryText: { contains: q, mode: 'insensitive' } },
        { sourceDomain: { contains: q, mode: 'insensitive' } }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { issue: true, category: true, tags: { include: { tag: true } } }
  })
}

/** Placeholder for hybrid search. Add pgvector + embeddings later. */
export async function hybridSearch(q: string, limit = 20) {
  return keywordSearch(q, limit)
}
