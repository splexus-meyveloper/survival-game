// Eleman (Worker) entity'si — binaya atanan üretim artırıcı
export class Worker {
  readonly id: number;
  atanenBinaIndex: number | null = null;

  constructor(id: number) { this.id = id; }

  binayaAta(binaIndex: number): void {
    this.atanenBinaIndex = binaIndex;
  }

  serbest(): void {
    this.atanenBinaIndex = null;
  }
}
