import type { ScoringGroup } from '../app/game'

export type GroupListProps = {
  groups: ReadonlyArray<ScoringGroup>
  total: number
  activeGroupIds?: ReadonlyArray<string>
  variant?: "compact" | "list"
  aggregatePairs?: boolean
}

type DisplayRow = {
  key: string
  label: string
  points: number
  groupIds: ReadonlyArray<string>
}

function pairRankFromIds(cardIds: ReadonlyArray<string>): string {
  const first = cardIds[0] ?? ""
  return first.startsWith("10") ? "10" : first.slice(0, -1)
}

function aggregateDisplay(groups: ReadonlyArray<ScoringGroup>, aggregatePairs: boolean): DisplayRow[] {
  if (!aggregatePairs) {
    return groups.map((g) => ({
      key: g.id,
      label: g.label,
      points: g.points,
      groupIds: [g.id],
    }))
  }
  // Bucket pair groups by rank first, without changing the kernel's
  // fifteen → pair → run → flush → nobs order: each rank's aggregated row is
  // emitted in the position of that rank's *first* pair group, so the
  // overall row order still matches scoreHandDetailed's group order.
  const pairBuckets = new Map<string, ScoringGroup[]>()
  for (const g of groups) {
    if (g.category !== "pair") {
      continue
    }
    const rank = pairRankFromIds(g.cardIds)
    const bucket = pairBuckets.get(rank) ?? []
    bucket.push(g)
    pairBuckets.set(rank, bucket)
  }
  const emittedRank = new Set<string>()
  const rows: DisplayRow[] = []
  for (const g of groups) {
    if (g.category !== "pair") {
      rows.push({ key: g.id, label: g.label, points: g.points, groupIds: [g.id] })
      continue
    }
    const rank = pairRankFromIds(g.cardIds)
    if (emittedRank.has(rank)) {
      continue
    }
    emittedRank.add(rank)
    const bucket = pairBuckets.get(rank) ?? [g]
    if (bucket.length === 3) {
      rows.push({
        key: `pair-set:${rank}`,
        label: "Three of a kind",
        points: 6,
        groupIds: bucket.map((b) => b.id),
      })
    } else if (bucket.length === 6) {
      rows.push({
        key: `pair-set:${rank}`,
        label: "Four of a kind",
        points: 12,
        groupIds: bucket.map((b) => b.id),
      })
    } else {
      for (const b of bucket) {
        rows.push({ key: b.id, label: b.label, points: b.points, groupIds: [b.id] })
      }
    }
  }
  return rows
}

export function GroupList({
  groups,
  total,
  activeGroupIds,
  variant = "list",
  aggregatePairs = true,
}: GroupListProps) {
  const rows = aggregateDisplay(groups, aggregatePairs)
  const active = new Set(activeGroupIds ?? [])
  return (
    <div className={`groupList grouplist groupList--${variant}${variant === "compact" ? " compact" : ""}`}>
      <ol className="groupList-items">
        {rows.map((row) => {
          const isActive = row.groupIds.some((id) => active.has(id))
          return (
            <li
              key={row.key}
              className={isActive ? "groupList-item is-active active" : "groupList-item"}
            >
              <span className="groupList-label lbl">
                {isActive ? <span className="groupList-marker" aria-hidden="true">▸ </span> : null}
                {row.label}
                {isActive ? <span className="visually-hidden"> (found)</span> : null}
              </span>
              <span className="groupList-points pts">{row.points}</span>
            </li>
          )
        })}
      </ol>
      <p className="groupList-total total" aria-label={`Total ${total}`}>
        Total <span className="groupList-totalNum">{total}</span>
      </p>
    </div>
  )
}
