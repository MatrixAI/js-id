async function sleep(ms: number) {
  return await new Promise((r) => setTimeout(r, ms));
}

function shuffle(arr: Array<any>): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export { sleep, shuffle };
