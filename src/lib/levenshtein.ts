/** Classic edit-distance: how many single-character insert/delete/substitute
 * operations turn `a` into `b`. Used to catch likely river-name typos. */
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const dp = new Array(n + 1)
  for (let j = 0; j <= n; j++) dp[j] = j

  for (let i = 1; i <= m; i++) {
    let prevDiagonal = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prevDiagonal : 1 + Math.min(prevDiagonal, dp[j], dp[j - 1])
      prevDiagonal = temp
    }
  }
  return dp[n]
}
