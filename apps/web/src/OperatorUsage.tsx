import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { fn } from "./firebase";
import type { Locale } from "@story/contracts";
interface Usage {
  reservedUSD: number;
  active: number;
  jobs: number;
  failures: number;
  tokens: number;
  medianMs: number | null;
  p95Ms: number | null;
  sampleSize: number;
}
export function OperatorUsage({
  campaignId,
  locale,
}: {
  campaignId: string;
  locale: Locale;
}) {
  const [data, setData] = useState<Usage | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void httpsCallable<{ campaignId: string }, Usage>(
      fn,
      "operatorUsage",
    )({ campaignId })
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [campaignId]);
  const es = locale === "es";
  return (
    <section className="usage">
      <h3>{es ? "Uso de la campaña" : "Campaign usage"}</h3>
      {error ? (
        <p>{es ? "No se pudo consultar el uso." : "Could not load usage."}</p>
      ) : !data ? (
        <p>…</p>
      ) : (
        <dl>
          <dt>
            {es
              ? "Presupuesto reservado (estimación)"
              : "Reserved budget (estimate)"}
          </dt>
          <dd>${data.reservedUSD.toFixed(3)}</dd>
          <dt>{es ? "Tareas / errores" : "Jobs / failures"}</dt>
          <dd>
            {data.jobs} / {data.failures}
          </dd>
          <dt>{es ? "Tokens registrados" : "Recorded tokens"}</dt>
          <dd>{data.tokens}</dd>
          <dt>{es ? "Duración mediana / p95" : "Median / p95 duration"}</dt>
          <dd>
            {data.sampleSize
              ? `${data.medianMs} / ${data.p95Ms} ms · n=${data.sampleSize}`
              : es
                ? "Sin muestras"
                : "No samples"}
          </dd>
        </dl>
      )}
    </section>
  );
}
