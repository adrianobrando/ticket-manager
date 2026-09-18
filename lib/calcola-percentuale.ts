export function calcolaPercentuale(
  oreStimate: number,
  oreConsuntivate: number,
  stato: string,
): number | null {
  if (stato === "done") {
    return 100;
  }

  if (oreStimate <= 0) {
    return null;
  }

  const percentuale = (oreConsuntivate / oreStimate) * 100;
  const percentualeArrotondata = Math.round(percentuale / 5) * 5;

  return Math.min(95, percentualeArrotondata);
}
