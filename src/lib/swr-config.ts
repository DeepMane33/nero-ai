export const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

export const swrConfig = {
  revalidateOnFocus: true,
  dedupingInterval: 5000,
  errorRetryCount: 2,
}
