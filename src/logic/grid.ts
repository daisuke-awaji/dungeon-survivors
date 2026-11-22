export interface GridItem {
  x: number;
  y: number;
  radius: number;
}

/** 当たり判定を速くするための空間グリッド。毎フレーム clear → insert し直して使う */
export class SpatialGrid<T extends GridItem> {
  private readonly cells = new Map<number, T[]>();
  private readonly pool: T[][] = [];

  constructor(private readonly cellSize: number) {}

  private key(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  clear(): void {
    for (const list of this.cells.values()) {
      list.length = 0;
      this.pool.push(list);
    }
    this.cells.clear();
  }

  insert(item: T): void {
    const k = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    let list = this.cells.get(k);
    if (!list) {
      list = this.pool.pop() ?? [];
      this.cells.set(k, list);
    }
    list.push(item);
  }

  /** 円 (x, y, r) と重なるものを out に追加して返す。相手の radius も考える */
  query(x: number, y: number, r: number, out: T[], maxItemRadius = 120): T[] {
    const reach = r + maxItemRadius;
    const x0 = Math.floor((x - reach) / this.cellSize);
    const x1 = Math.floor((x + reach) / this.cellSize);
    const y0 = Math.floor((y - reach) / this.cellSize);
    const y1 = Math.floor((y + reach) / this.cellSize);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.cells.get(this.key(cx, cy));
        if (!list) continue;
        for (const item of list) {
          const dx = item.x - x;
          const dy = item.y - y;
          const rr = r + item.radius;
          if (dx * dx + dy * dy <= rr * rr) out.push(item);
        }
      }
    }
    return out;
  }
}
